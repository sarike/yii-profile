# yii-profile

yii-profile is a NodeJs command line tool for parse Yii2 profile log.

## Install

```
npm install -g yii-profile
```

## Usage

```
Usage: yii-profile your_profile.log [Options]

Options:
  -s, --start-time  The start time to profile.
  -f, --filename    File name of the result html file.
                                 [required] [default: "yii-profile-output.html"]
  -o, --output      Output dir of the result html file.
  -x, --exclude     Categories you want to exclude.      [default: "^yii\\\\db"]
  -h, --help        Show help                                          [boolean]
```

