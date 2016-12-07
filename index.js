#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const yargs = require('yargs');
const swig = require('swig');
const childProcess = require('child_process');

const argv = yargs
  .usage('Usage: $0 your_profile.log [Options]')
  .option('s', {
    alias: 'start-time',
    description: 'The start time to profile.'
  })
  .option('f', {
    required: true,
    alias: 'filename',
    default: 'yii-profile-output.html',
    description: 'File name of the result html file.'
  })
  .option('o', {
    alias: 'output',
    description: 'Output dir of the result html file.'
  })
  .option('x', {
    alias: 'exclude',
    default: '^yii\\\\db',
    description: 'Categories you want to exclude.'
  })
  .demand(1, 'Profile log file(s) is required')
  .help('h').alias('h', 'help').argv;

const startTime = argv.s ? Date.parse(argv.s) : null;
const exclude = argv.x;

const FLAG_PROFILE_BEGIN = 'profile begin';
const FLAG_PROFILE_END = 'profile end';

const _logReg = /^(.+\s.+?)\s\[(.+)\]\[(.+)\]\[(.+)\]\[(.+)\]\[(.+)\](.+)$/;
const _stack = [];
const _result = {};

function processProfileEndLog(timeStamp, message, cat) {
  let lastIndex = _stack.length - 1;
  if (
    lastIndex === -1 ||
    _stack[lastIndex]['flag'] !== FLAG_PROFILE_BEGIN ||
    _stack[lastIndex]['message'] !== message
  ) return;
  let begin = _stack.pop();
  let dt = timeStamp - begin['timeStamp'];
  if (!_result[message]) {
    _result[message] = {
      count: 0,
      total: 0,
      max: 0,
      min: 0,
      cat: null
    };
  }
  let cMax = _result[message]['max'];
  let cMin = _result[message]['min'];
  _result[message]['cat'] = cat;
  _result[message]['count']++;
  _result[message]['total'] += dt;
  _result[message]['max'] = dt > cMax ? dt : cMax;
  _result[message]['min'] = (cMin > 0 && dt > cMin) ? cMin : dt;
}

function getRL(file) {
  return readline.createInterface({
    input: fs.createReadStream(file)
  });
}

function renderOutput(data, done) {
  const tpl = swig.compileFile(__dirname + '/index.html');
  const outputHTML = tpl(data);
  if (argv.o) {
    outputInDir(argv.o, outputHTML, done);
    return;
  }
  fs.mkdtemp('/tmp/yii-profile-', (err, folder) => {
    if (err) {
      done(err, null);
      return;
    }
    outputInDir(folder, outputHTML, done);
  });
}

function outputInDir(folder, outputHTML, done) {
  let filePath = folder + path.sep + argv.f;
  fs.writeFile(filePath, outputHTML, err => {
    if (err) {
      done(err, null);
      return;
    }
    done(null, filePath);
  });
}

function main() {
  argv._.forEach(f => {
    let rl = getRL(f);
    rl.on('line', l => {
      let lastIndex = _stack.length - 1;
      let m = l.match(_logReg);
      if (!m) {
        if (_stack.length === 0) return;
        _stack[lastIndex]['message'] += l;
        return;
      }
      let [, time, ip, user, sid, flag, cat, message] = m;
      let timeStamp = Date.parse(time);
      if (startTime && startTime > timeStamp) return;
      if (exclude && cat.match(exclude)) return;
      if (flag === FLAG_PROFILE_END) {
        processProfileEndLog(timeStamp, message, cat);
      }
      else if (flag === FLAG_PROFILE_BEGIN) {
        _stack.push({
          timeStamp, ip, user, sid, flag, cat, message: message
        });
      }
    }).on('close', () => {
      let sortedKeys = Object.keys(_result).sort((a, b) => {
        return _result[b]['total']/_result[b]['count'] - _result[a]['total']/_result[a]['count'];
      });
      renderOutput({
        result: _result,
        sortedKeys,
      }, (err, o) => {
        if (err) throw err;
        childProcess.exec('open ' + o);
        process.exit(0);
      });
    });
  });
}

main();