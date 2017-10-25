// THESE ROUTES ARE USED AND CALLED FROM EXTERNAL WEB-SERVERS OR FRONT-ENDS.
// FOR EXAMPLES THEY ARE CALLED FROM BACK-END OF CONT-AUTH-WEBSITE.

var User = require('../models/user');
var KeystrokeDataModel = require('../models/keystrokes')
var jwt = require('jsonwebtoken');
var config = require('../../config');
// var keyboardMap = require('../helpers/keyboardmap')

// Outliers in milliseconds
const UPPER_OUTLIER_THRESH = 2000;
const LOWER_OUTLIER_THRESH = 10;


module.exports = function(app, express) {


    var miscRouter = express.Router();


    // api endpoint to get the keystrokes profile of subject
    // The request is performed from the cont auth website back-end
    // The request must include the track_code and the username of the subject whose keystroke profile must be queried. (avg latency, std, minmax etc)
    miscRouter.route('/mykeyprofile')

    .get(function(req, res) {
        console.log('Subject wants his keystroke profile data->');
        console.log(req.get('user-key-profile-request'));

        // Extract track_code and subject from my custom http headers
        const reqInfo = JSON.parse(req.get('user-key-profile-request'));
        const track_code = reqInfo.track_code;
        const subject = reqInfo.subject;


        // create an instance of the Keystrokedata model
        var keystrokeData = new KeystrokeDataModel();

        // ->Return the subject with this track_code and with this subject's name and select its sessions
        KeystrokeDataModel.findOne({
            track_code: track_code,
            subject: subject
        }).select('sessions').exec(function(err, doc) {
            if (err) throw err;

            if (!doc) {
                // Track code or subject's name not found in keystrokedata model
                res.json({
                    success: false,
                    message: 'Track Code or Subject name not found!'
                });
                console.log('KeystrokeProfile Request, Response: Track Code or Subject name not found!');

            } else {
                // Track code subcjet's name is  found at this point
                // console.log('!!!!DEBUGGING!!!!!!!!!!!');
                // console.log(doc.sessions);

                // Obtain keystroke_dt and keystroke_code as nested arrays
                var keystroke_dt = doc.sessions.map(function(a) { return a.keystroke_dt; })
                var keystroke_code = doc.sessions.map(function(a) { return a.keystroke_code; })
                    // console.log(keystroke_code);

                // Flatten the nested arrays to one
                keystroke_dt = [].concat.apply([], keystroke_dt);
                keystroke_code = [].concat.apply([], keystroke_code);
                // console.log(keystroke_code);
                // console.log('!!!!!DEBUGGG!!!!!!!!!!!');
                // console.log(keystroke_dt);

                // debug
                console.log('(DEBUGGING), lengths:');
                console.log(keystroke_dt.length);
                console.log(keystroke_code.length);

                // Find mathematical data
                const keystroke_dt_min = myMin(keystroke_dt);
                const keystroke_dt_max = myMax(keystroke_dt);
                console.log('MAX = ');
                console.log(keystroke_dt_max);
                console.log('MIN = ');
                console.log(keystroke_dt_min);
                const myArrAvg = arrAvg(keystroke_dt); // used to calcualte avg and std
                const keystroke_dt_avg = Math.round(myArrAvg);
                const keystroke_dt_std = Math.round(calcStd(myArrAvg, arrSquaredAvg(keystroke_dt)));
                // Find the fastest and slowest digraph
                const keystroke_fastest_digraph = myFastestDigraph(keystroke_dt, keystroke_code, keystroke_dt_min);
                const keystroke_slowest_digraph = mySlowestDigraph(keystroke_dt, keystroke_code, keystroke_dt_max);

                // Construct the profile as JSON object
                const keyprofileObj = {
                    total_keystrokes: keystroke_dt.length,
                    min: keystroke_dt_min,
                    max: keystroke_dt_max,
                    avg: keystroke_dt_avg,
                    std: keystroke_dt_std,
                    fastest_digraph: keystroke_fastest_digraph,
                    slowest_digraph: keystroke_slowest_digraph
                };



                // Send back the results
                res.json({ success: true, keyprofile: keyprofileObj });
            }
        });


    });



    // Returns a random sentence with the maximum specified length
    miscRouter.route('/get-random-sentence/:MAXIMUM_LENGTH')
        .get(function(req, res) {

            var paragraphs = require('../models/randomparagraphs').paragraphs;

            /* Get a random paragraph. */
            var tmp = paragraphs[getRandomInt(0, paragraphs.length - 1)];
            /* Get a random sentence within this paragraph */
            var rSplit = tmp.split(' ');

            rSplit = rSplit.slice(getRandomInt(0, rSplit.length - 5), rSplit.length - 1); // max 5 words from the end

            var ret = '';
            for (let i = 0; i < rSplit.length; i++) {
                ret += rSplit[i] + ' ';
            }

            ret = ret.trim();
            ret = restrictStringLength(ret, Number(req.params.MAXIMUM_LENGTH));

            res.json({ success: true, sentence: ret })
        });


    return miscRouter;

}



/************************************************************************************** */
// Inline functions

/**
 * Returns a random integer between the specified range
 */
function getRandomInt(minimum, maximum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

/**
 * Restrict string length without cutting last word
 * @param {string} str
 * @param {number} maxStrSize
 */
function restrictStringLength(str, maxStrSize) {
    if (str.length > maxStrSize) {
        var temp = str;
        if (temp[maxStrSize] !== ' ') {
            var offset = temp.substring(maxStrSize).indexOf(' ');
            if (offset > -1) {
                maxStrSize += offset;
            } else {
                maxStrSize = str.length;
            }
        }
    }
    return str.substr(0, maxStrSize);
}

// Return average of a number array starting at index 'from' and ending to index 'to-1'
function arrAvg(myArr, from = 0, to = myArr.length) {
    let sum = 0;
    let countEndDelims = 0; // counter to count outliers so that you exclude them to calc avg
    for (let i = from; i < to; i++) {
        // if it's end delimeter ignore it
        if (isOutlier(myArr[i])) {
            countEndDelims++;
            continue;
        }

        sum = sum + myArr[i];
    }

    return sum / (myArr.length - countEndDelims);
}


// Return the squared average of a number array (used to calculate standard deviation)
function arrSquaredAvg(myArr, from = 0, to = myArr.length) {
    let sqSum = 0;
    let countEndDelims = 0; // counter to count outliers so that you exclude them to calc sq avg
    for (let i = from; i < to; i++) {
        // if it's end delimeter ignore it
        if (isOutlier(myArr[i])) {
            countEndDelims++;
            continue;
        }
        sqSum = sqSum + Math.pow(myArr[i], 2);
    }
    // console.log(sqSum);
    return sqSum / (myArr.length - countEndDelims);
}


// Return the standard deviation from eqaution: s^2 = E[x^2] - E[x]^2
function calcStd(myAvg, mySquaredAvg) {
    return Math.sqrt(mySquaredAvg - Math.pow(myAvg, 2));
}


// Returns the fastest digraph (the fastest combination of 2 character eg 'df')
// It finds it based on the minimum val of keystroke_dt
function myFastestDigraph(keystroke_dt, keystroke_code, minKeyDtVal) {
    let index = keystroke_dt.indexOf(minKeyDtVal);
    console.log('INDEX TOY MY FASTEST');
    console.log(index);
    // return keyboardMap.key[keystroke_code[index][0]].concat(keyboardMap.key[keystroke_code[index][1]])
    let ret = (String.fromCharCode(keystroke_code[index][0]).concat(String.fromCharCode(keystroke_code[index][1]))).toLowerCase();
    return ret.replace('@', '#').replace('@', '#');
}

// Returns the slowest digraph (the slowest combination of 2 character eg 'df')
// It finds it based on the maximum val of keystroke_dt
function mySlowestDigraph(keystroke_dt, keystroke_code, maxKeyDtVal) {
    let index = keystroke_dt.indexOf(maxKeyDtVal);
    console.log('INDEX TOY MY SLOWEST');
    console.log(index);
    // return keyboardMap.key[keystroke_code[index][0]].concat(keyboardMap.key[keystroke_code[index][1]])
    let ret = (String.fromCharCode(keystroke_code[index][0]).concat(String.fromCharCode(keystroke_code[index][1]))).toLowerCase();
    return ret.replace('@', '#').replace('@', '#');
}

// Returns the minimum value of arr (excluding the -1 which is the delimeter)
function myMin(arr) {
    mymin = 1234568;
    for (let i = 0; i < arr.length; i++) {
        if (isOutlier(arr[i])) continue;
        if (arr[i] < mymin) { mymin = arr[i]; };
    }
    return mymin;
}

// Returns the maximum value of arr (excluding the outliers)
function myMax(arr) {
    mymax = -2;
    for (let i = 0; i < arr.length; i++) {
        if (isOutlier(arr[i])) continue;
        if (arr[i] > mymax) { mymax = arr[i]; };
    }
    return mymax;
}

// Checks if a number is an outlier
function isOutlier(num) {
    return ((num < LOWER_OUTLIER_THRESH) || (num > UPPER_OUTLIER_THRESH))
}