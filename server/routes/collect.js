var User = require('../models/user');
var KeystrokeDataModel = require('../models/keystrokes')
var config = require('../../config');
var fs = require('fs');
var PythonShell = require('python-shell');

module.exports = function(app, express) {

    var collectRouter = express.Router();


    collectRouter.route('/get_keystroke_code_collect_limit/:track_code')
        .get(function(req, res) {

            User.findOne().elemMatch("projects", { "track_code": req.params.track_code }).exec(function(err, admin) {
                if (err) return res.send(err);
                if (!admin) {
                    console.log('Track code given from the client script is wrong');
                    res.json({ success: false, message: 'Track code given from the client script is wrong' });
                } else {

                    // Load the appropriate keystroke_code_collect_limit
                    let track_code_arr = admin.projects.map(a => String(a.track_code));
                    let _projectIndex = track_code_arr.indexOf(req.params.track_code);
                    console.log('Client Script: Keystroke Collect Limit Loaded.');
                    console.log(admin);
                    res.json({ success: true, keystroke_code_collect_limit: admin.projects[_projectIndex].keystroke_code_collect_limit })
                }
            })
        });


    collectRouter.route('/keystrokes')
        //  (accessed at POST http://localhost:8080/collect/keystrokes)
        // this route is used to collect keystrokes from key-logger script of cont auth website
        .post(function(req, res) {

            console.log('\n\nGathering new data.......');
            console.log('\nOrigin (without http(s)): ' + req.headers.origin.split('/')[2]);
            console.log(req.body);
            console.log('\n');


            // check body for missing data
            if (req.body.track_code == null) {
                res.json({ success: false, message: 'Track code is missing.' })
                console.log('Track code is missing');
                return;
            } else if (req.body.subject == null || req.body.subject == '') {
                res.json({ success: false, message: 'Subject is missing.' })
                console.log('Subject is missing');
                return;
            } else if (req.body.keystroke_code == null || req.body.keystroke_code == '[]') {
                res.json({ success: false, message: 'Keystroke Codes are missing.' });
                console.log('Keystroke Codes are missing.');
                return;
            } else if (req.body.keystroke_dt == null || req.body.keystroke_dt == '[]') {
                res.json({ success: false, message: 'Keystroke Dts are missing.' });
                console.log('Keystroke Dts are missing.');
                return;
            }

            // Check if the requested track_code and the origin header is correct
            User.findOne({ projects: { $elemMatch: { "track_code": req.body.track_code, "siteurl": req.headers.origin.split('/')[2] } } })
                .exec(function(err, admin) {
                    if (err) throw err;
                    if (!admin) {
                        res.json({
                            success: false,
                            message: '******Track Code && Site Url Origin dont match!'
                        });
                        console.log('Track code && site url Origin dont match!');
                    } else if (admin) {

                        // Find the data from the project with this track_code
                        let track_code_arr = admin.projects.map(a => String(a.track_code));
                        let _projectIndex = track_code_arr.indexOf(req.body.track_code);

                        // The track_code & siteurl is found and is valid at this point.
                        // Now take care of the subject to log the key data correctly.
                        // The subject can either be a new one (no records yet) or an old one.
                        // Also, if it's an old one you must check the date of the latest session of the subject. If it's older than 1 day then create a new session
                        // So find the session with subject:req.body.subject and and session.date less than one day diff with the present day of today.
                        // if the query return null then the doc will be created, else the doc will be updated (according to the sessionStart flag of http post req)

                        // Parse the JSON to arrays
                        try {
                            var keystroke_dt_new = JSON.parse(req.body.keystroke_dt);
                            var keystroke_code_new = JSON.parse(req.body.keystroke_code);
                        } catch (errr) {
                            console.log('ERROR AT JSON PARSE:');
                            console.log(errr);
                            return res.json({ success: false, message: 'Error check the console' });
                        }

                        // create a new instance of the Keystrokedata model
                        var keystrokeModel = new KeystrokeDataModel();

                        // Try to find the subject and select its sessions and di_gmms
                        KeystrokeDataModel.findOne({ subject: req.body.subject, track_code: req.body.track_code }).select('sessions di_gmms rejections is_trained').exec(function(error, doc) {
                            if (error) throw error;

                            // Subject doesn't exist, create new document
                            // No need to perform testing at this point.
                            if (!doc) {
                                console.log('No subject with this username exists');
                                console.log('Creating new document');

                                keystrokeModel.subject = req.body.subject;
                                keystrokeModel.track_code = req.body.track_code;
                                keystrokeModel.sessions = { keystroke_code: keystroke_code_new, keystroke_dt: keystroke_dt_new };

                                keystrokeModel.save(function(err) {
                                    if (err) {
                                        res.json({ message: 'Error Saving data.' });
                                        console.log(err);
                                        return;
                                    }

                                    res.json({ message: 'KeystrokeData Received for track-code: ' + req.body.track_code });
                                    console.log('KeystrokeData Created for track-code: ' + req.body.track_code);
                                });

                            } else {

                                if (doc.is_trained && admin.projects[_projectIndex].enable_keyguard_auth_flag) {
                                    /** Keystroke Authentication Phase Starts here.
                                     * Subject: doc.subject
                                     * Trained Models: doc.di_gmms
                                     * Digraph Data to be tested against trained models: keystroke_dt_new, keystroke_code_new
                                     */
                                    var data = { testing_threshold: admin.projects[_projectIndex].testing_threshold, n_components: admin.projects[_projectIndex].training_n_components, di_gmms: doc.di_gmms, testing: { keystroke_dt: keystroke_dt_new, keystroke_code: keystroke_code_new } };
                                    console.log(' Calling Python Script for Testing... \n')
                                    var options = {
                                        mode: 'json',
                                        scriptPath: '././python_scripts/'
                                    };
                                    var pyshell = new PythonShell('test.py', options);

                                    // Send the data to be tested to python script as json
                                    pyshell.send(data).end(function(err) {
                                        if (err) console.log(err)
                                    });

                                    // Log the message returned from python
                                    pyshell.on('message', function(message) {

                                        if (typeof message.data == 'string') {
                                            console.log(message.data);
                                        } else if (typeof message.data == 'object') {
                                            console.log(message.data);
                                            // console.log(message.data.dt);
                                            // console.log(message.data.di);
                                            if (message.data.not_enough_training == true) {
                                                console.log('Not enough training for user!!')
                                                    // Continue by saving his sessions
                                                saveKeystrokeDataWrapper(res, doc, keystroke_code_new, keystroke_dt_new, req.body.track_code);
                                                return;
                                            } else {
                                                if (message.data.passed == true) {
                                                    console.log('***User passed!***');
                                                    // Continue by saving his sessions
                                                    saveKeystrokeDataWrapper(res, doc, keystroke_code_new, keystroke_dt_new, req.body.track_code);
                                                    return;
                                                } else {
                                                    console.log('***User rejected!***');
                                                    doc.rejections = doc.rejections + 1;
                                                    doc.save();
                                                    return res.json({ alert: true, isImpostor: true, message: 'User did not passed test' });
                                                }
                                            }
                                        }
                                    });


                                } else {

                                    /**
                                     * This subject hasn't been trained his data yet, so just store it!
                                     */
                                    saveKeystrokeDataWrapper(res, doc, keystroke_code_new, keystroke_dt_new, req.body.track_code);

                                }






                            }
                        });

                    }
                });




        })

    return collectRouter;
}



/** Saves keystroke data according to daily sessions
 *
 */
function saveKeystrokeDataWrapper(res, doc, keystroke_code_new, keystroke_dt_new, track_code) {
    // Update it according to latest date

    // Get today
    let today = new Date();

    if (!(doc.sessions[doc.sessions.length - 1].date.getUTCFullYear() == today.getUTCFullYear() &&
            doc.sessions[doc.sessions.length - 1].date.getUTCMonth() == today.getUTCMonth() &&
            doc.sessions[doc.sessions.length - 1].date.getUTCDate() == today.getUTCDate())) {

        console.log('(Latest session is not from todays)');
        let newData = { keystroke_code: keystroke_code_new, keystroke_dt: keystroke_dt_new };
        doc.sessions.push(newData);
        doc.save();


    } else {
        console.log('(Latest session is from todays)');
        doc.sessions[doc.sessions.length - 1].keystroke_dt = doc.sessions[doc.sessions.length - 1].keystroke_dt.concat(keystroke_dt_new);
        doc.sessions[doc.sessions.length - 1].keystroke_code = doc.sessions[doc.sessions.length - 1].keystroke_code.concat(keystroke_code_new);
        doc.sessions[doc.sessions.length - 1].date = new Date();

        doc.save();
    }

    res.json({ alert: false, message: 'KeystrokeData Received for track-code: ' + track_code });
    console.log('KeystrokeData Updated for track-code: ' + track_code);

}













//returns date1 - date2 in days
function getDaysDifference(date1, date2) {
    //format of days: YEAR-MONTH-DAY
    let date_1 = date1.split('-').map(Number);
    let date_2 = date2.split('-').map(Number);

    if (date_1[0] > date_2[0]) {
        return date_1[0] - date_2[0];
    }

    if (date_1[1] > date_2[1]) {
        return 30 * (date_1[1] - date_2[1]);
    }

    return date_1[2] - date_2[2];

}