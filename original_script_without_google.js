var request = require("request"),
    cheerio = require("cheerio"),
    fs      = require("fs"),
    moment  = require("moment"),
    CronJob = require("cron").CronJob,
    prepend = require("prepend-file"),
    // url     = "http://127.0.0.1:8080/index.html";
    url     = "http://192.168.5.198/index.html?em";


/*
*   check for es2015 Promise support
*   if not, load a polyfill
*/
if(typeof(Promise) != "function"){
    require('es6-promise').polyfill();
}


/*
*   create the base 'mutated' variable to be mutated
*/
var mutated;


/*
*   specify file to write to
*/
var output_file = "output\ Feb\ 9-10,\ 2016.csv";


/*
*   Header to prepend on output.csv
*/
var headerText = "date, input, temperature, humidity, lux\r\n";


/*
*   cool variable name
*   holds the letters that are used to .split the array
*   mutated.indexOf(what[i])
*/
var whatArray = ["T", "H", "I"];


/*
*   prepAndSplit() runs first
*   Using the whatArray, runs insertCommasLoop(str, what)
*   until complete, then converts mutated into an array
*   [ "split", "by", "commas" ]
*/
var prepAndSplit = function(){
    for (var i = 0; i < whatArray.length; i++){
        insertCommasLoop(mutated, whatArray[i]);
    }
};


/*
*   insertCommasLoop, from prepAndSplit()
*   takes "abc", makes it ["a","b","c"]
*   finds index of "what" from the loop
*   inserts a comma at that index position
*   rejoins ["a",", b","c"] into "a, bc"
*/
var insertCommasLoop = function(str, what){
    var splitter = str.split('');
    splitter.splice(splitter.indexOf(what), 0, ',');
    mutated = splitter.join('');
};


/*
*   removeFirstCharacter() is a funky multi-use
*   function runs first removes white space,
*   does a hard split like insertCommas does
*   removes the first index completely [0],
*   inserts a comma directly after the new first index [0],
*   joins it back together.
*/
var removeFirstCharacter = function(){
    var splitter = mutated.split('');
    splitter.splice(0,1);
    splitter.splice(1,0,",");
    mutated = splitter.join('');
};


/*
*   removeModelNumber() removes index location [1]
*   which is the model number, useless data.
*   splits string by ",", then joins by ",".
*   unlike insertCommas and removeFirstCharacter
*   which split literally every character apart like
*   ["s", "p", "l", "i", "t" ]
*/
var removeModelNumber = function(){
    var splitter = mutated.split(',');
    splitter.splice(1,1);
    mutated = splitter.join(',');
};


/*
*   removePrefixes() deletes the unit
*   designations in front of the numbers,
*   for example "TF:100.75" becomes "100.75"
*/
var removePrefixes = function(){
    var splitter = mutated.split(',');
    var buffer = [];
    buffer.push(splitter[0]);
    for(var i = 1; i < splitter.length; i++){
        buffer.push(splitter[i].substring(3, splitter[i].length));
    }
    mutated = buffer.join(',');
};


/*
*   complete() Runs last.
*   fs.appendFile will create output_file.
*   It will append new values to the bottom.
*   If file has no header, it will prepend
*   one using check_line();
*/
var complete = function(){
    var date = moment().format("l H:mm:ss");
    text = date + "," + mutated + "\r\n";

    fs.appendFile(output_file, text, function (err) {
        console.log(text);
    });
};


/*
*   Check to see if output.csv has a header,
*   if not, prepend it to the top.
*   Allows text to be written before check to prevent
*   an error if the file does not exist.
*
*   I took both of these from stackoverflow
*   they've got some mysterious magic happening, idk
*/
var check_line = function(){
    get_line(output_file, 0, function(err, line){
        if (!err){
            var buffer = line.split(',');
            if(buffer[0] == 'date'){
                return;
            } else {
                prepend(output_file, headerText);
            }
        }
        return;
    });
};
var get_line = function(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\r\n");
    if(+line_no > lines.length){
      throw new Error('File end reached without finding line');
    }
    callback(null, lines[+line_no]);
};


/*
*   Cron for the win!
*   Runs every thirty seconds.
*
*   requests the url (similar to http.get).
*   finds the text inside the body using jquery (cheerio for the win!).
*   removes all leading/trailing whitespace including inside the string.
*   begins the promise stream.
*
*/
new CronJob('*/30 * * * * *', function() {
    console.log('You will see this message every 30 seconds');

    request(url, function (error, response, body) {
        if (!error) {
            var $ = cheerio.load(body);
            var rawResponse = $("body").text();
            mutated = rawResponse.replace(/\s+/g, '');
            Promise.all(
                [
                    removeFirstCharacter(),
                    prepAndSplit(),
                    removeModelNumber(),
                    removePrefixes(),
                    complete(),
                    check_line()
                ]
            ).then(function() {
                console.log("completed transformation:", mutated);
            });

        } else {
            console.log("We’ve encountered an error: " + error);
        }
    });
}, null, true);


/*
*   fin
*/