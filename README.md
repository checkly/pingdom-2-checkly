# Pingdom 2 Checkly

Use this Node.js script to convert Pingdom HTTP type checks to Checkly API type checks.

**Requirements**

- Node.js
- A Pingdom API key
- A Checkly API key

**Usage**

```bash
git clone https://github.com/checkly/pingdom-2-checkly.git
cd pingdom-2-checkly
npm install
node index.js --pingdomApiKey <pingdom APi key> --checklyApiKey <checkly API key>
```

> note: this script is mostly for internal Checkly usage. There are no tests and it works only is specific cases.
