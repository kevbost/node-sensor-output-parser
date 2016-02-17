## Instructions

1. run $`npm install` to install dependencies
2. update `var url = . . .` in `server.js`
3. `index.html` is available for testing, but it must be served to `localhost`
4. $`node server.js` will run indefinitely, `ctrl+c` to exit.
5. Authentication files not provided.  See https://www.npmjs.com/package/google-spreadsheet for instructions on how that was created.
    1. delete `auth = require("./auth.js")`
    2. update `my_sheet = new GoogleSheet(auth.secretKey())` to `my_sheet = new GoogleSheet("secret key")`
    3. update `creds = require(auth.credsFile())` to `creds = require("./google-sheet-name-[secret key].json")`

---

Start parser with $`node server.js` or $`npm start`