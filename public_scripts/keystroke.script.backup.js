/**
 * Developed by Tasos Kakouris
 */

// NOTES FOR DEVELOPERS.

// -How this script gets the user information (like his username)
// When the user logins, the back-end responds with the user's info like username and ofcourse his jwt-token.
// Then these infos are stored to session storage.
// So, as soon as the login button is pressed (click event is fired) the script begin to check the session storage
// for changes and scans the storage to find the user's username.
// The scan is performed every 100ms after the user has pressed the login button.
// Obviously if some time has passed and the session storage hasn't changed yet then it means that the login
// was unsuccesful so the script should stop searching the sessionstorage.
// Eventually on a successful login the script will have the valid credentials of the user

// -How this script logs keystroke data
// When a user presses a key (keydown) the keyCode of the key is recorded along with a timestamp, in this way between
// two keydown's we have one digraph latency (the time between two keystrokes)

// Keycode 64 represents a number. (any number from 0-9 is represented by 64 in this script)

// -When this script sends the data that has recorded
// As soon as the data length is enough (for example every KEYSTROKE_CODE_COLLECT_LIMIT keystrokes), the script sends the data to the cont-auth-server back-end.
// The body of the http request is: track_code, subject (the username of user), keystroke_dt, keystroke_code

console.log('Keystroke Analytics Script Starting...');


// =======================================================================
/*********** Init Settings and Variables *************/

// used for keystroke data & logging:
var allDOMS = document.getElementsByTagName('*'); // get all DOMS
var keydownDOMObserver = Rx.DOM.keydown(allDOMS); // observe  keydown
var KEYSTROKE_CODE_COLLECT_LIMIT_BACKUP; // send data every fixed num of digraphs
var KEYSTROKE_CODE_COLLECT_LIMIT; // send data every every fixed num of digraphs
var keystroke_dt = []; // array with digraph latenciies eg: [45,100,54...]
var keystroke_code = [
    []
]; // array of digraph arrays with key code pressed eg: [[60,63],[63,79],[79,81]...] each digraph represnets one entry in keystroke_dt
var t1 = -1; // used to calculate time differences (its initial value is used as a delimeter)
var t2;

// used for http requests
var myheaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
let tmp = document.getElementById('contAuthServerScriptTag').src.split('/');
var cont_auth_server_url = tmp[0] + '//' + tmp[2];
var cont_auth_server_get_keystroke_code_limit = cont_auth_server_url + '/collect/' + 'get_keystroke_code_collect_limit/' + track_code
var cont_auth_server_collect_url = cont_auth_server_url + '/collect/' + 'keystrokes';
//console.log('Server requests TO: ' + cont_auth_server_url);

// used for detection of token/log-in/username session etc:
const STORAGE_GET_ITEM_FAIL_COUNT_THRESH = 25; //translated to seconds-> *100ms = ...
const FIND_USERNAME_INTERVAL_PERIOD = 100; // ms
var storageGetItemFailCount = 0; // if sessionStorage.getItem('currentUser') returns null, then this variable counts it
var currentUser = { 'username': '', 'token': '' };
var loggedInFlag = false;
var findUsernameInterval;

// Used for impostor detection etc
var insideImpostorModalFlag = false; // Becomes true when impostor modal is activated


/* Load the keystroke_code_collect_limit  from the server */
getKeystrokeCodeCollectLimit();

// **** There is a possibility that the user initiates the page while is stil logged in.
// That can happen if the user clicks the refresh button while he is still logged in, then the script will incorrectly
// wait for a login click event, but the user is already logged in!
// So just on a page initiation check for a username for once.
findUsername(true);



// ============================================================================================================================
/***********RxJs Event Listeners and  Subscribers *************/

/**
 * Is called when the users tries to close the tab/browser forcefully.
 * Is used to send any data left before the user has left.
 */
window.addEventListener('beforeunload', function(event) {

    // Check if user tries to "escape" the impostor modal procedure
    if (insideImpostorModalFlag) {
        console.log('User tries to escape');
        sessionStorage.clear();
        // event.preventDefault();
    } else {
        if (keystroke_dt.length > 0 && loggedInFlag) {
            if (keystroke_code[keystroke_code.length - 1].length < 2) keystroke_code.pop() // if the last is not a completed digraph remove it
            sendData();
            keystroke_code = [
                []
            ];
            keystroke_dt = [];
            // edw mipws na kanw clear kai to T1 ?
            t1 = -1;
            // sessionStorage.clear(); // safety
            console.log('Unload: Data Sent');
            event.preventDefault();
        }
    }


});

/**
 * Is called on click events.
 * Is used to detect logins and logouts of the user.
 */
window.addEventListener('click', function(event) {

    // check if LOGIN is clicked
    if (event.target && event.target.id == 'logginButtonID') {
        console.log('login clicked');
        // Start searching for username & token in session storage
        findUsernameInterval = setInterval(findUsername, FIND_USERNAME_INTERVAL_PERIOD); // call findUsername() every 100ms
    }
    // check if LOGOUT is clicked
    else if (event.target && event.target.id == 'logoutHrefID') {
        console.log('logout clicked');
        if (keystroke_code.length > 0) {
            // Send what is left, user is logged out
            if (keystroke_code[keystroke_code.length - 1].length < 2) { keystroke_code.pop(); } // if the last is not a completed digraph remove it
            sendData();
        }
        // Reset variables
        resetLogInStuff();
        resetKeystrokeData();
        resetT1();
    }
});



/**
 * RXJS Subscribtion to keydown.
 */
var keystrokeSubscriber = keydownDOMObserver.subscribe(
    //keyEvent => onKeyDownProcedure(keyEvent),
    function(keyEvent) {
        onKeyDownProcedure(keyEvent);
    },
    function(err) {
        console.log('Error in keydown event: ' + err);
    });



// =====================================================================================================================================
/******************************Functions **************************/

/**
 * Loads the keystroke code collect limit for this track_code from the keyguard-server (set by admin)
 */
function getKeystrokeCodeCollectLimit() {
    Rx.DOM.get({ url: cont_auth_server_get_keystroke_code_limit, headers: myheaders })
        .subscribe(
            function(data) {
                res = JSON.parse(data.response);
                if (res.success == true) {
                    KEYSTROKE_CODE_COLLECT_LIMIT = Number(res.keystroke_code_collect_limit);
                    KEYSTROKE_CODE_COLLECT_LIMIT_BACKUP = Number(res.keystroke_code_collect_limit);
                    console.log('Keystroke Code Limit Loaded to: -> ' + String(KEYSTROKE_CODE_COLLECT_LIMIT))
                } else {
                    console.log('Problem with collect keystroke code limit');
                    KEYSTROKE_CODE_COLLECT_LIMIT = 20;
                    KEYSTROKE_CODE_COLLECT_LIMIT_BACKUP = 20;
                    console.log(res);
                }
            },
            function(error) {
                KEYSTROKE_CODE_COLLECT_LIMIT = 20;
                KEYSTROKE_CODE_COLLECT_LIMIT_BACKUP = 20;
                console.log('Error at get keystroke code collect limit');
                console.log(error);
            });
}

/**
 * Is called on the keyDown Event.
 * Is used to log the keystroke data
 * @param {Event} e The KeyboardEvent
 */
function onKeyDownProcedure(e) {

    if (loggedInFlag) {

        logKeystrokeData(e);

    } else {

        /* At this point user typed on keyboard without being logged in
            Log the keystrokes, only for the keystroke-auth-box section (not for username or password)
        */
        if (e.target.classList.contains('keystroke-auth-box-user-feedback')) {
            logKeystrokeData(e, false);
        }

    }

}

/**
 * Is called to log Keystroke Data. The function uses Date.now().
 * The flagDetermines if the function will send the data when the keystroke_code max length is reached
 * @param {Event} e The keyboard event.
 * @param {boolean} sendAfterCodeLengthLimitFlag
 */
function logKeystrokeData(e, sendAfterCodeLengthLimitFlag = true) {

    t2 = Date.now(); // get milliseconds

    let keyCode;
    /* distinguish if its a number or char or nothing of above */
    if (e.keyCode >= 65 && e.keyCode <= 90) {
        keyCode = e.keyCode;
    } else if (e.key >= '1' && e.key <= '9') {
        keyCode = 64;
    } else {
        return;
    }

    //console.log(keyCode);

    /* Check If it's the first keycode pressed ever on this session (after the log-in) */
    if (t1 != -1) {

        keystroke_dt.push(Math.round(t2 - t1)); // It's not the first

        /* Store keycode data according to index */
        keystroke_code[keystroke_code.length - 1].push(keyCode); // Push it to second place of present digraph eg: [[2,THIS]]

        /* Check if it's time to send the data. (Only for logged in ) */
        if (keystroke_code.length >= KEYSTROKE_CODE_COLLECT_LIMIT && sendAfterCodeLengthLimitFlag) {
            sendData();
            // Reset it
            keystroke_code = [
                [keyCode] // this is the last keycode press by the user. It must be recorded for the next timing
            ];
            keystroke_dt = [];
        } else {
            keystroke_code.push([keyCode]); // Push it to first place of next digraph eg: [[2,3],[THIS,]]
        }

    } else {
        /* Its the first so store only code data */
        keystroke_code[0].push(keyCode);
    }
    t1 = t2; // for next calculation

}



/**
 * Is called to send Data to the server. Performs Rx.DOM POST.
 * Also, according to the server response, the function may call other functions that block or allow user access.
 */
function sendData() {

    //console.log('Performing Post request...');
    // perform POST request
    let dataBody = { track_code: track_code, subject: currentUser.username, keystroke_code: JSON.stringify(keystroke_code), keystroke_dt: JSON.stringify(keystroke_dt) };
    //console.log(dataBody);
    Rx.DOM.post({ url: cont_auth_server_collect_url, body: dataBody, headers: myheaders })
        .subscribe(
            function(data) {
                res = JSON.parse(data.response);

                /* Check if there is an alert for the user -*/
                if (res.alert == true && loggedInFlag) {
                    if (res.isImpostor == true) {
                        console.log('Server: User is impostor!');
                        // Check if maybe impostor modal is already activated
                        if (!insideImpostorModalFlag) {
                            activateImpostorModal();
                        } else {
                            // At this point, user was detected as impostor in the past, and didn't pass the retake-test.
                            // So drop him out of the system (back to log-in page)
                            deactivateImpostorModal();
                            activateUserRejectedModal(5000);
                            setTimeout(function() { window.location.replace(window.location.origin + '/login'); }, 4500);
                        }
                    } else {
                        if (res.not_enough_training == true) {
                            alert('Impostor Alert Failed: Not enough training to test the data!!!');
                        }
                    }
                    // PROSOXI TI GINETE AN DN EXW ENOUGGH TRAINING????
                } else {
                    if (!insideImpostorModalFlag) {
                        // all good
                        //console.log(res.message);
                    } else {
                        // User was detected as impostor in the past, and DID pass the retake-test.
                        // So deactivate impostor modal and continue.
                        deactivateImpostorModal();
                        insideImpostorModalFlag = false;
                        activateUserRetakeSuccessModal();
                        resetKeystrokeData();
                        resetT1();
                        KEYSTROKE_CODE_COLLECT_LIMIT = KEYSTROKE_CODE_COLLECT_LIMIT_BACKUP;
                    }

                }

            },
            function(err) {
                console.log('Error at ajax POST: ');
                console.log(err);
            }
        );

}


/**
 * It's the first function ever that is called. It's used to detect the subject's username from the sessionStorage.
 * The function searches periodically, in the sessionStorage for a valid token, in order to parse the username.
 * If the flag justOnce == true, then the function executes just once (no interval)
 * @param {boolean} justOnce
 */
function findUsername(justOnce = false) {
    console.log('Searching username');
    // Try to get currentUser info from session storage
    let tmp_currentUser = sessionStorage.getItem('currentUser');


    // Check if nothing is  there
    if (tmp_currentUser == null) {
        if (justOnce) { console.log('Username not found'); return; }
        storageGetItemFailCount++; // track how many fails
        if (storageGetItemFailCount >= STORAGE_GET_ITEM_FAIL_COUNT_THRESH) { // 2.5 sec
            /* stop searching for username, log-in was uncsuccesful */
            console.log('find username failed');
            if (findUsernameInterval) {
                clearInterval(findUsernameInterval)
                storageGetItemFailCount = 0;
                return;
            };
        }
    } else {

        // Something was found. Try to JSON parse it
        try {
            tmp_currentUser = JSON.parse(tmp_currentUser);
            //console.log(tmp_currentUser);

            // Something was found. Decode jwt-token and acquire username from the decoded token
            try {
                console.log('Trying to decode token');
                //console.log(tmp_currentUser.token);
                let decode_tok = jwt_decode(tmp_currentUser.token);
                //console.log(decode_tok);
                // try to get username frmo the decoded_token
                let tmp_username = decode_tok['username'];
                if (tmp_username === undefined) {
                    console.log('No username in this jwt-token');
                    // storageGetItemFailCount++;
                } else {
                    // username retrieval was succesful. Save current user
                    console.log('Username found ->');
                    console.log(tmp_currentUser.username);
                    currentUser.token = tmp_currentUser.token;
                    currentUser.username = tmp_username;
                    // Also update variables
                    loggedInFlag = true;
                    if (findUsernameInterval) clearInterval(findUsernameInterval); // stop searching. username & token is found succesfully.

                    /* Send keystroke data from login box */
                    if (keystroke_code[keystroke_code.length - 1].length != 2) { keystroke_code.pop(); }
                    sendData();
                    resetKeystrokeData();
                    resetT1();

                }
            } catch (err) {
                console.log('Invalid jwt-token');
                console.log(err);
                storageGetItemFailCount++;
            }

        } catch (error) {
            console.log('Error in JSON.parse of currentUser');
            console.log(error);
        }

    }
}


/**
 *  Called when a user do not pass the keystroke authentication test
 */
function activateImpostorModal() {
    console.log('Inside activate Impostor Modal...');
    insideImpostorModalFlag = true;

    // Load html modal
    if (!document.getElementById('keyguardScriptImpostorModal')) {
        $(document.body).append('\
        <div class="modal" id="keyguardScriptImpostorModal">\
          <div class="modal-dialog">\
            <div class="modal-content">\
              <div class="modal-header" style="text-align:center;">\
                 <i class="fa fa-hand-paper-o fa-4x" style="color:red;" aria-hidden="true"></i>\
                <h3 class="modal-title" style="font-weight:bold;">&nbsp;Keystroke Authentication Failed!</h3>\
              </div>\
              <div class="modal-body">\
                 <p style="text-align:center;margin-top:-10px;font-size:14px;">You are requested to <strong>type the text below</strong> , in order to continue browsing this website.</p>\
                <br>\
                <div class="retake-access-container" style="border-radius:7px;background-color:rgba(0, 0, 0,0.84);padding:25px 8px 30px 8px;">\
                  <div class="retake-p-input" style="text-align:center;">\
                     <p id="keyguardScriptretakeP" style="font-size:20px;color:white;"><img src="data:image/gif;base64,R0lGODlhEAAQAPIAAP///wAAAMLCwkJCQgAAAGJiYoKCgpKSkiH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAADMwi63P4wyklrE2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQJCgAAACwAAAAAEAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUkKhIAIfkECQoAAAAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9HMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkECQoAAAAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYumCYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkECQoAAAAsAAAAABAAEAAAAzIIunInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQJCgAAACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJibufbSlKAAAh+QQJCgAAACwAAAAAEAAQAAADMgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFGxTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAkKAAAALAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdceCAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsRkAAAOwAAAAAAAAAAAA=="></p>\
                  </div>\
                  <div class="retake-input" style="text-align:center;">\
                     <input id="keyguardScriptretakeInput" placeholder="type the sentence above" style="width:70%;color:black;font-size:20px;">\
                  </div>\
                </div>\
             </div>\
            </div>\
          </div>\
        </div>')
    } else {
        // reset loading, html modal is already ready
        $('#keyguardScriptretakeP').html('<img src="data:image/gif;base64,R0lGODlhEAAQAPIAAP///wAAAMLCwkJCQgAAAGJiYoKCgpKSkiH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAADMwi63P4wyklrE2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQJCgAAACwAAAAAEAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUkKhIAIfkECQoAAAAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9HMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkECQoAAAAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYumCYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkECQoAAAAsAAAAABAAEAAAAzIIunInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQJCgAAACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJibufbSlKAAAh+QQJCgAAACwAAAAAEAAQAAADMgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFGxTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAkKAAAALAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdceCAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsRkAAAOwAAAAAAAAAAAA==">')
    }

    // Clear the input for safety
    $('#keyguardScriptretakeInput').val('');

    // Pop modal
    $("#ngx-app-container-wrapper").css("opacity", "0");
    $('#keyguardScriptImpostorModal').modal({ backdrop: 'static', keyboard: false })

    // Load a random quote.
    var randomQuote = '...';
    $.ajax({
        url: 'https://quotesondesign.com/wp-json/posts?filter[orderby]=rand&filter[posts_per_page]=1&jsonp=mycallback',
        cache: false,
        success: function(data) {
            //console.log(data);
            randomQuote = data[0].content;
            randomQuote = restrictStringLength(stripNonLettersAndNonNumbersFromString(stripHtmlFromString(randomQuote).trim()), 30).toLowerCase();
            $('#keyguardScriptretakeP').text(randomQuote);
            // Reset keystroke data and adjust keystroke code length limit
            resetKeystrokeData();
            resetT1();
            KEYSTROKE_CODE_COLLECT_LIMIT = (randomQuote.length) - (randomQuote.split(' ').length - 1) - 2; // two less for safety
        },
        error: function(err) {
            console.log('Error on QuotesOnDesign HTTP GET')
            console.log(err);
            randomQuote = 'hey what are you doing'; // just in case http get fails
        }
    });

}

/**
 * Closes impostor modal
 */
function deactivateImpostorModal() {
    $('#keyguardScriptImpostorModal').modal('hide');
    $("#ngx-app-container-wrapper").css("opacity", "1");
}


/**
 * Activates the user rejected modal for a period of ms
 * @param {number} ms
 */
function activateUserRejectedModal(ms) {
    $(document.body).append('\
    <div class="modal" id="keyguardScriptUserRejectedModal">\
      <div class="modal-dialog">\
        <div class="modal-content">\
          <div class="modal-header" style="text-align:center;">\
            <i class="fa fa-ban fa-4x" style="color:red;" aria-hidden="true"></i>\
            <h2 class="modal-title" style="font-weight:bold;">&nbsp;You are rejected!</h2>\
            <p style="font-style:italic;">You will be redirected back to login page.</p>\
          </div>\
        </div>\
      </div>\
    </div>')
    $("#ngx-app-container-wrapper").css("opacity", "0");
    $('#keyguardScriptUserRejectedModal').modal({ backdrop: 'static', keyboard: false });

    setTimeout(function() {
        deactivateUserRejectedModal();
    }, ms)
}

/**
 * DeactivatesUserRejectedModal
 */
function deactivateUserRejectedModal() {
    $('#keyguardScriptUserRejectedModal').modal('hide');
    $("#ngx-app-container-wrapper").css("opacity", "1");
}


/**
 *  Activates the user Retake Modal when user pass the retake test.
 */
function activateUserRetakeSuccessModal() {

    if (!document.getElementById('keyguardScriptUserRetakeSuccessModal')) {
        $(document.body).append('\
        <div class="modal" id="keyguardScriptUserRetakeSuccessModal">\
          <div class="modal-dialog">\
            <div class="modal-content">\
              <div class="modal-header" style="text-align:center;">\
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\
                 <i class="fa fa-check-circle fa-4x" aria-hidden="true" style="color:green;"></i>\
                <h2 class="modal-title" style="font-weight:bold;">You passed the test!</h2>\
              <p style="font-style:italic;">You can continue browsing this website.</p>\
                <div align="right"><button type="button" class="btn btn-default"  data-dismiss="modal">Close</button></div>\
              </div>\
            </div>\
          </div>\
        </div>')
    }

    $("#ngx-app-container-wrapper").css("opacity", "1");
    $('#keyguardScriptUserRetakeSuccessModal').modal('show');
}


/**
 * Strip html tags from string
 * @param {string} htmlStr
 */
function stripHtmlFromString(htmlStr) {
    var html = htmlStr;
    var div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

/**
 * Strip non-letters (and non-numbers) from string
 * @param {string} str
 */
function stripNonLettersAndNonNumbersFromString(str) {
    var ret = '';
    for (let i = 0; i < str.length; i++) {
        if ((str[i].toLowerCase() >= 'a' && str[i].toLowerCase() <= 'z') || (str[i] >= '0' && str[i] <= '9') || str[i] == ' ') {
            ret += str[i];
        }
    }
    return ret;
    // return str.replace(/(\r\n|\n|\r|\t|\.|\,|\'|\"|\-|\;)/gm, '')
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

/**
 * Resets keystroke data
 */
function resetKeystrokeData() {
    keystroke_code = [
        []
    ];
    keystroke_dt = [];
}

/**
 * Resets t1
 */
function resetT1() {
    t1 = -1;
}

/**
 * Resets log in flags
 */
function resetLogInStuff() {
    currentUser.token = '';
    currentUser.username = '';
    loggedInFlag = false;
}