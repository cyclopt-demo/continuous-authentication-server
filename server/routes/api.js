var path = require('path');
var fs = require('fs');
var PythonShell = require('python-shell');
var User = require('../models/user');
var KeystrokeDataModel = require('../models/keystrokes')
var jwt = require('jsonwebtoken');
var config = require('../../config');
var superSecret = config.secret; // super secret for creating tokens
var beautify = require("json-beautify");

module.exports = function (app, express) {

    var apiRouter = express.Router();

    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/authenticate
     * Used to authenticate users
     */
    apiRouter.post('/authenticate', function (req, res) {
        console.log('yea');
        User.findOne({
            username: req.body.username
        }).select('username firstname lastname password date projects').exec(function (err, user) {
            if (err) return res.send(err);
            if (!user) {
                res.json({
                    success: false,
                    message: 'Authentication failed. User not found.'
                });
            } else if (user) {
                var validPassword = user.comparePassword(req.body.password);
                if (!validPassword) {
                    res.json({
                        success: false,
                        message: 'Authentication failed. Wrong password.'
                    });
                } else {
                    var token = jwt.sign({
                        username: user.username
                    }, superSecret, {
                        expiresIn: '300d'
                    });
                    console.log(user);
                    res.json({
                        success: true,
                        message: 'Enjoy your token!',
                        token: token,
                        username: user.username,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        _id: user._id,
                        date: user.date,
                        projects: user.projects
                    });
                }
            }
        });
    });


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * Route middleware for all api requests
     */
    apiRouter.use(function (req, res, next) {
        console.log('Somebody just came to our app!');
        //check if user wants to register  so avoid middleware
        if ((req.path != '/users') || (req.method != 'POST')) {
            var token = req.body.token || req.params.token || req.headers['x-access-token'] || req.query.token;
            if (token) {
                jwt.verify(token, superSecret, function (err, decoded) {
                    if (err) {
                        console.log('Failed to auth token');
                        res.json({
                            success: false,
                            message: 'Failed to authenticate token',
                            val: 'failtok'
                        });
                        return;
                    } else {
                        req.decoded = decoded;
                        next();
                    }
                });
            } else {
                console.log('No token provided.');
                res.json({
                    success: false,
                    message: 'No token provided.',
                    val: 'notok'
                });

            }
        } else {
            console.log('User wants to register');
            next();
        }
    });



    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/users
     * Register users
     */
    apiRouter.route('/users')
        // create a user (accessed at POST http://localhost:8080/api/users)
        .post(function (req, res) {
            var user = new User();
            user.username = req.body.username;
            user.firstname = req.body.firstname;
            user.lastname = req.body.lastname;
            user.password = req.body.password;
            user.save(function (err) {
                if (err) {
                    if (err.code == 11000) // duplicate entry
                        return res.json({
                            success: false,
                            message: 'A user with that username already exists. '
                        });
                    else
                        return res.send(err);
                }
                res.json({
                    success: true,
                    message: 'User created!'
                });
            });
        })

        // get all the users (accessed at GET http://localhost:8080/api/users)
        .get(function (req, res) {
            User.find(function (err, users) {
                if (err) res.send(err);
                // return the users
                res.json(users);
            });
        });


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/users/:user_id
     * To work with specific user ids
     */
    apiRouter.route('/users/:user_id')
        // (accessed at GET http://localhost:8080/api/users/:user_id)
        .get(function (req, res) {
            User.findById(req.params.user_id, function (err, user) {
                if (err) res.send(err);
                console.log('response from server');
                console.log(JSON.stringify(user))
                res.json(user);
            });
        })

        // update the user with this id
        // (accessed at PUT http://localhost:8080/api/users/:user_id)
        .put(function (req, res) {
            User.findById(req.params.user_id, function (err, user) {
                if (err) res.send(err);
                if (req.body.firstname) user.firstname = req.body.firstname;
                if (req.body.lastname) user.lastname = req.body.lastname;
                if (req.body.username) user.username = req.body.username;
                user.save(function (err) {
                    if (err) res.send(err);
                    res.json({
                        success: true,
                        message: 'User updated!',
                        user: user
                    });
                });
            });
        })

        // delete the user with this id
        // (accessed at DELETE http://localhost:8080/api/users/:user_id)
        .delete(function (req, res) {
            User.remove({
                _id: req.params.user_id
            }, function (err, user) {
                if (err) return res.send(err);
                res.json({
                    message: 'Successfully deleted'
                });
            });
        });

    // api endpoint to get user information
    apiRouter.get('/me', function (req, res) {
        res.send(req.decoded);
    });


    //----------------------------------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------------------------------

    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/project/:user_id
     * To create a new project
     */
    apiRouter.route('/project/:user_id')
        .post(function (req, res) {
            console.log('User wants to create new project');
            console.log(req.body);
            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (!user) {
                    res.json({
                        success: false,
                        message: 'No user with this id exists'
                    });
                } else {
                    var proj = {
                        siteurl: req.body.siteurl,
                        track_code: req.body.siteurl.hashCode()
                    };
                    user.projects.push(proj);
                    user.save(function (err) {
                        if (err) return res.send(err);
                        res.json({
                            success: true,
                            message: 'Project created succesfully',
                            project: user.projects[user.projects.length - 1]
                        });
                    });

                }
            });
        });


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/projects/:user_id
     * To get all projects of a user
     */
    apiRouter.route('/projects/:user_id')
        .get(function (req, res) {
            console.log('User wants all his projects');
            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (!user) {
                    res.json({
                        success: false,
                        message: 'No user with this username exists'
                    });
                } else {
                    res.json({
                        success: true,
                        projects: user.projects
                    });
                }
            });
        });



    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/project/:user_id/:project_id
     * GET: to get an existing project
     * PUT: to edit an existing project
     * DELETE: to delete an existing project
     * req.body: {project: {....}}
     */
    apiRouter.route('/project/:user_id/:project_id')
        .get(function (req, res) {
            console.log('User wants to get an existing project');
            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (!user) {
                    res.json({
                        success: false,
                        message: 'Wrong user id'
                    })
                } else {
                    res.json({
                        success: true,
                        project: user.projects[arrIdFromJsonArray(user.projects).indexOf(req.params.project_id)]
                    })
                }
            });
        })


        .put(function (req, res) {
            console.log('User wants to edit an existing project');
            console.log(req.body);

            if (req.body.project == undefined) {
                return res.json({
                    success: false,
                    message: 'Project missing from body.'
                })
            }

            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (!user) {
                    res.json({
                        success: false,
                        message: 'No user with this id exists'
                    });
                } else {
                    // Get the project with the specific project_id
                    let _projectIndex = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                    var track_code_changed_flag = false;
                    if (_projectIndex !== -1) {
                        bodyProject = req.body.project;
                        let _project = user.projects[_projectIndex];
                        if (bodyProject.siteurl !== undefined) {
                            _project.siteurl = bodyProject.siteurl;
                            _project.track_code = bodyProject.siteurl.hashCode();
                            track_code_changed_flag = true;
                        }
                        if (bodyProject.keystroke_code_collect_limit) _project.keystroke_code_collect_limit = bodyProject.keystroke_code_collect_limit;
                        if (bodyProject.training_digraph_min_samples) _project.training_digraph_min_samples = bodyProject.training_digraph_min_samples;
                        if (bodyProject.training_outlier_max_dt) _project.training_outlier_max_dt = bodyProject.training_outlier_max_dt;
                        if (bodyProject.training_outlier_min_dt) _project.training_outlier_min_dt = bodyProject.training_outlier_min_dt;
                        if (bodyProject.training_n_components) _project.training_n_components = bodyProject.training_n_components;
                        if (bodyProject.testing_threshold) _project.testing_threshold = bodyProject.testing_threshold;
                        if (bodyProject.enable_keyguard_auth_flag !== undefined) {
                            _project.enable_keyguard_auth_flag = bodyProject.enable_keyguard_auth_flag;
                        }
                        user.projects[_projectIndex] = _project;
                        user.save(function (err1) {
                            if (err1) return res.send(err1);
                            res.json({
                                success: true,
                                track_code_changed_flag: track_code_changed_flag,
                                message: 'Project changed succesfully',
                                project: user.projects[_projectIndex]
                            });
                        })
                    } else {
                        res.json({
                            success: false,
                            message: 'Project id invalid'
                        })
                    }

                }
            });
        })


        .delete(function (req, res) {
            console.log('User wants to delete an existing project');
            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (!user) {
                    res.json({
                        success: false,
                        message: 'Wrong user id'
                    })
                } else {
                    let _projectIndexToRemove = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                    const track_code_to_delete = user.projects[_projectIndexToRemove].track_code;
                    let tmp = user.projects;
                    tmp.splice(_projectIndexToRemove, 1);
                    user.projects = tmp;
                    user.save(function (err) {
                        if (err) return res.send(err);
                        // Delete keystroke data also
                        KeystrokeDataModel.remove({
                            track_code: track_code_to_delete
                        }, function (err2) {
                            if (err2) return res.send(err2);
                            res.json({
                                success: true,
                                message: 'Project deleted succesfully',
                                projects: user.projects
                            })
                        });
                    });
                }
            });
        })


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/train/:user_id
     * To train your model with the specific project id
     * req.body.training_settings.training_n_components,
       req.body.training_settings.training_outlier_min_dt,
       req.body.training_settings.training_outlier_max_dt,
       req.body.training_settings.training_digraph_min_samples
     */
    apiRouter.route('/train/:user_id/:project_id')
        // (accessed at POST)
        .post(function (req, res) {
            console.log('\nSomeone wants to train his model');
            console.log(req.body);
            console.log(req.params);
            User.findById(req.params.user_id, function (err1, user) {
                if (err1) {
                    console.log(err1);
                    res.send(err1);
                    return;
                }
                if (!user) {
                    console.log('Admin userid not found');
                    res.json({
                        success: false,
                        message: 'Your id is invalid'
                    });

                } else {
                    console.log(user);

                    // Load the project and get its track_code
                    let _projectIndex = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                    if (_projectIndex == -1) {
                        return res.json({
                            success: false,
                            message: 'Project id invalid'
                        });
                    }

                    const track_code = user.projects[_projectIndex].track_code;
                    console.log('Admin userid found. Track code:' + track_code);


                    // Find the subjects with this track_code
                    KeystrokeDataModel.find({
                        'track_code': track_code
                    }, function (err, docs) {
                        if (err) console.log('error occured in the database');
                        if (!docs.length) {
                            console.log('Track code doesnt exist in subjects yet.');
                            res.json({
                                message: 'You do not have any data to train yet!'
                            });
                        } else {
                            // console.log(docs);
                            console.log(' Calling Python Script for Training... \n')

                            // Call the python script
                            //var PythonShell = require('python-shell');
                            var options = {
                                mode: 'json',
                                scriptPath: '././python_scripts/'
                            };

                            var pyshell = new PythonShell('train.py', options);

                            // Send the data to be trained to python script as json
                            pyshell.send({
                                docs: docs,
                                training_n_components: req.body.training_settings.training_n_components,
                                training_outlier_min_dt: req.body.training_settings.training_outlier_min_dt,
                                training_outlier_max_dt: req.body.training_settings.training_outlier_max_dt,
                                training_digraph_min_samples: req.body.training_settings.training_digraph_min_samples
                            }).end(function (err2) {
                                if (err2) console.log(err2);
                            })

                            // Log the message returned from python
                            pyshell.on('message', function (message) {

                                if (typeof message.data == 'string') {
                                    console.log(message.data);
                                } else if (typeof message.data == 'object') {
                                    // console.log(message.data);
                                    // Save results to database
                                    var arrObj = message.data;
                                    // obj is an array of json objects
                                    // each json has: {subject: 'deagle', di_data:  [], di_gmms: []}
                                    // di_data is like 26x26 (1d array by row), each cell has the data for the particular di
                                    // di_gmms is like 26x26 (1d array by row), each cell has the gmm model data for the particular di
                                    // console.log(arrObj);
                                    for (let i = 0; i < arrObj.length; i++) {
                                        docs[i].di_gmms = arrObj[i].di_gmms;
                                        docs[i].is_trained = true;
                                        docs[i].save();
                                    }

                                    // Update Training Settings
                                    user.projects[_projectIndex].last_train_date = new Date();
                                    user.projects[_projectIndex].training_n_components = req.body.training_settings.training_n_components;
                                    user.projects[_projectIndex].training_outlier_min_dt = req.body.training_settings.training_outlier_min_dt;
                                    user.projects[_projectIndex].training_outlier_max_dt = req.body.training_settings.training_outlier_max_dt;
                                    user.projects[_projectIndex].training_digraph_min_samples = req.body.training_settings.training_digraph_min_samples;
                                    // console.log(user);
                                    user.save();

                                    res.json({
                                        success: true,
                                        message: 'Training Completed Succesfully!'
                                    })

                                }

                            });



                        }
                    });
                }
            });
        })


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/dashboard_data/:user_id/:project_id
     */
    apiRouter.route('/dashboard_data/:user_id/:project_id')

        /**
          ACCESSED AT GET  api/dashboard_data/:user_id/:project_id
          To receive users statistics from an admin project
          Statistics to be returned:
            dashboardData = {
                totalUsers_genStat,
                totalSessions_genStat,
                totalKeystrokes_genStat,
                latestSession_genStat,
                totalRejections_genStat,
                userStatistics: [{id, is_trained, total_keystrokes, min, max, avg, std, fastest_di, slowest_di, rejections}]
            }
         */
        .get(function (req, res) {
            console.log('Someone wants his dashboard data');

            // Find the user by his id
            User.findById(req.params.user_id, function (err, user) {

                if (err) {
                    console.log(err);
                    return res.json(err);
                }

                if (!user) {
                    console.log('Admin userid not found');
                    res.json({
                        success: false,
                        message: 'Your id is invalid'
                    });
                } else {

                    // Get his track_code from his project
                    let _projectIndex = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                    if (_projectIndex == -1) {
                        return res.json({
                            success: false,
                            message: 'Project id invalid'
                        });
                    }
                    const track_code = user.projects[_projectIndex].track_code;

                    // Find all the subjects who have this track_code
                    KeystrokeDataModel.find({
                        track_code: track_code
                    }, function (err, docs) {
                        if (err) {
                            console.log(err);
                            return res.json(err);
                        }

                        if (!docs.length) {
                            console.log('No subjects for this track_code: ' + track_code);
                            return res.json({
                                success: false,
                                val: 'no-subjects',
                                dashboardData: {}
                            });
                        } else {
                            // console.log(docs);

                            // Initialize the return data
                            let dashboardData = {
                                totalUsers_genStat: 0,
                                totalSessions_genStat: 0,
                                totalKeystrokes_genStat: 0,
                                latestSession_genStat: '',
                                totalRejections_genStat: 0,
                                userStatistics: []
                            }

                            // console.log(dashboardData);
                            // Find Total Users
                            dashboardData.totalUsers_genStat = docs.length;
                            // Find The Other Stuff
                            docs.forEach(function (doc) {
                                // For total Rejections
                                dashboardData.totalRejections_genStat += doc.rejections;
                                // For total sessions
                                dashboardData.totalSessions_genStat += doc.sessions.length;
                                // For gen statistics
                                let tempObj = {
                                    id: doc._id,
                                    is_trained: doc.is_trained,
                                    total_keystrokes: 0,
                                    min: 12345,
                                    max: -1,
                                    avg: 0,
                                    std: 0,
                                    fastest_di: '',
                                    slowest_di: '',
                                    rejections: doc.rejections
                                };
                                let docDt = [];
                                let docCode = [];
                                doc.sessions.forEach(function (session) {
                                    // For total keystrokes
                                    dashboardData.totalKeystrokes_genStat += session.keystroke_dt.length;
                                    // For Latest session date
                                    if (dashboardData.latestSession_genStat < session.date)
                                        dashboardData.latestSession_genStat = session.date;
                                    // For gen statistics
                                    docDt = docDt.concat(session.keystroke_dt);
                                    docCode = docCode.concat(session.keystroke_code);
                                });
                                // For gen statistics
                                tempObj.total_keystrokes = docDt.length;
                                tempObj.min = myMin(docDt);
                                tempObj.max = myMax(docDt);
                                tempObj.avg = Math.round(arrAvg(docDt));
                                tempObj.std = Math.round(calcStd(tempObj.avg, arrSqAvg(docDt)));
                                tempObj.fastest_di = myFastestDigraph(docDt, docCode, tempObj.min);
                                tempObj.slowest_di = mySlowestDigraph(docDt, docCode, tempObj.max);
                                dashboardData.userStatistics.push(tempObj);
                            });
                            console.log('Dashboard data sent successfully.');
                            res.json({
                                success: true,
                                dashboardData: dashboardData
                            });
                        }
                    });
                }
            });
        })

        // Accessed at DELETE  /dashboard_data/:user_id/:project_id
        // Admin wants to delete the data of his subjects for this project
        .delete(function (req, res) {

            console.log('Admin wants to delete his keystroke subjects data for his project');
            // find the admin by his id
            User.findById(req.params.user_id, function (err, user) {

                if (err) {
                    return res.json(err)
                };

                if (!user) {
                    console.log('User id not found');
                    res.json({
                        success: false,
                        message: 'Problem with your userid.'
                    });
                } else {

                    console.log(user);

                    // Get his track_code from his project
                    let _projectIndex = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                    if (_projectIndex == -1) {
                        return res.json({
                            success: false,
                            message: 'Project id invalid'
                        });
                    }
                    const track_code = user.projects[_projectIndex].track_code;

                    // Delete all the subjects with his track_code
                    KeystrokeDataModel.remove({
                        track_code: track_code
                    }, function (err, obj) {
                        // console.log(obj);
                        if (err) {
                            console.log(err);
                            res.json(err);
                        }
                        if (obj.result.n == 0) {
                            console.log('Nothing to remove for this track_Code' + track_code);
                            res.json({
                                success: false,
                                message: 'You do not have any data to delete!'
                            });

                        } else {
                            console.log('Remove success');
                            // Data removed, reset train flag for admin project
                            user.projects[_projectIndex].last_train_date = undefined;
                            user.save(function (err3) {
                                if (err3) return res.send(err3);
                                res.json({
                                    success: true,
                                    message: 'Data removed succesfully'
                                });
                            });
                        }
                    });
                }
            });
        });

    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/subject_data/:user_id/:subject_id/:project_id
     * project_id is only used at DELETE
     */

    apiRouter.route('/subject_data/:user_id/:subject_id/:project_id')

        // To GET the collection for the subject_id
        .get(function (req, res) {
            console.log('User wants to download subjects data');
            console.log(req.params);

            // Find the user by his id
            User.findById(req.params.user_id, function (err, user) {

                if (err) {
                    console.log(err);
                    return res.json(err);
                }

                if (!user) {
                    console.log('Admin userid not found');
                    res.json({
                        success: false,
                        message: 'Your id is invalid'
                    });
                } else {

                    // Find the subject with the req.params.subject_id
                    KeystrokeDataModel.findOne({
                        _id: req.params.subject_id
                    }, '_id _v subject is_trained track_code sessions di_gmms rejections', function (err, doc) {
                        if (err) {
                            console.log(err)
                            return res.json(err);
                        }
                        if (!doc) {
                            console.log('Subject id not found on database');
                            res.json({
                                success: false,
                                message: 'Subject id not found on database'
                            });
                        } else {
                            console.log('Sending text back');
                            // console.log(doc);
                            // First remove the sucject name from doc and then return it as text
                            fs.writeFileSync('./subjects_data/subject-' + req.params.subject_id + '.json', beautify(doc, null, 2, 100), 'utf8');
                            res.set({
                                "Content-Disposition": "attachment"
                            });
                            res.sendFile(path.join(__dirname, '/../../subjects_data/subject-' + req.params.subject_id + '.json'));
                        }
                    });
                }

            });

        })


        // To delete specific subject data
        .delete(function (req, res) {
            console.log('User wants to delete data from one subject');
            console.log(req.params);

            // Find the user by his id
            User.findById(req.params.user_id, function (err, user) {

                if (err) {
                    console.log(err);
                    return res.json(err);
                }

                if (!user) {
                    console.log('Admin userid not found');
                    res.json({
                        success: false,
                        message: 'Your id is invalid'
                    });
                } else {

                    // Find the subject with  the req.params.subject_id
                    KeystrokeDataModel.remove({
                        _id: req.params.subject_id
                    }, function (err, obj) {
                        if (err) {
                            console.log(err)
                            return res.json(err);
                        }
                        if (obj.result.n == 0) {
                            console.log('Nothing to remove for  subject' + user.track_code);
                            res.json({
                                success: false,
                                message: 'Wrong subject id'
                            });

                        } else {
                            console.log('Remove success');
                            // Data removed, You may have to reset training flag for admin
                            let _projectIndex = arrIdFromJsonArray(user.projects).indexOf(req.params.project_id);
                            if (_projectIndex == -1) {
                                return res.json({
                                    success: false,
                                    message: 'Project id invalid'
                                });
                            }
                            const track_code = user.projects[_projectIndex].track_code;
                            KeystrokeDataModel.find({
                                track_code: track_code
                            }, function (err2, docs) {
                                if (err2) return res.send(err2);
                                if (docs.length == 0) {
                                    user.projects[_projectIndex].last_train_date = undefined;
                                    user.save();
                                    res.json({
                                        success: true,
                                        train_date_reset: true,
                                        message: 'Subject removed succesfully.'
                                    })
                                } else {
                                    res.json({
                                        success: true,
                                        train_date_reset: false,
                                        message: 'Subject removed succesfully'
                                    })
                                }
                            });
                        }
                    });
                }

            });
        });


    /** ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * api/gmm_data/:user_id/:subject_id/
     * TO GET THE GMM_DATA IN ORDER TO PLOT THE GAUSSIAN CURVES TO THE FRONT END
     */
    apiRouter.route('/gmm_data/:user_id/:subject_id')
        .get(function (req, res) {
            console.log('User wants to GET GMM_DATA for GMM CURVES');
            console.log(req.params);

            // Find the user by his id
            User.findById(req.params.user_id, function (err, user) {

                if (err) {
                    console.log(err);
                    return res.json(err);
                }

                if (!user) {
                    console.log('Admin userid not found');
                    res.json({
                        success: false,
                        message: 'Your id is invalid'
                    });
                } else {

                    // Find the subject with the req.params.subject_id
                    KeystrokeDataModel.findOne({
                        _id: req.params.subject_id
                    }, 'di_gmms', function (err, doc) {
                        if (err) {
                            console.log(err)
                            return res.json(err);
                        }
                        if (!doc) {
                            console.log('Subject id not found on database');
                            res.json({
                                success: false,
                                message: 'Subject id not found on database'
                            });
                        } else {
                            console.log('Removing nulls gmms');
                            // console.log(doc.di_gmms);
                            di_gmms_filtered = doc.di_gmms.filter(function (val) {
                                return val !== null;
                            });
                            console.log('Null gmms removed');
                            res.json({
                                success: true,
                                di_gmms: di_gmms_filtered,
                                message: 'Gaussian Mixture Data sent back successfully.'
                            })

                        }
                    });
                }

            });
        });



    return apiRouter;
};



// =================================================================
function arrIdFromJsonArray(objArr) {
    return objArr.map(a => String(a._id))
}
// Inline Functions
String.prototype.hashCode = function () {
    var hash = 0;
    for (let i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = hash + chr;
    }
    hash = Math.pow(hash, 4);

    return hash.toString();
};


// Returns the average of an array
function arrAvg(arr) {
    let sum = 0,
        outliersNum = 0;
    arr.forEach(function (val) {
        if (isOutlier(val)) {
            outliersNum++;
        } else {
            sum += val;
        }
    });
    return sum / (arr.length - outliersNum);
}

// Returns the squared avg of an array
function arrSqAvg(arr) {
    let sqSum = 0,
        outliersNum = 0;
    arr.forEach(function (val) {
        if (isOutlier(val)) {
            outliersNum++;
        } else {
            sqSum += Math.pow(val, 2);
        }
    });
    return sqSum / (arr.length - outliersNum);
}

// Return the standard deviation from eqaution: s^2 = E[x^2] - E[x]^2
function calcStd(avg, SqAvg) {
    return Math.sqrt(SqAvg - Math.pow(avg, 2));
}

// Returns the fastest digraph (the fastest combination of 2 character eg 'df')
// It finds it based on the minimum val of keystroke_dt
function myFastestDigraph(arrDt, arrCode, minArrDt) {
    let index = arrDt.indexOf(minArrDt);
    // return keyboardMap.key[arrCode[index][0]].concat(keyboardMap.key[arrCode[index][1]])
    let ret = (String.fromCharCode(arrCode[index][0]).concat(String.fromCharCode(arrCode[index][1]))).toLowerCase();
    return ret.replace('@', '#').replace('@', '#');
}

// Returns the slowest digraph
// It finds it based on the maximum val of keystroke_dt
function mySlowestDigraph(arrDt, arrCode, maxArrDt) {
    let index = arrDt.indexOf(maxArrDt);
    // return keyboardMap.key[arrCode[index][0]].concat(keyboardMap.key[arrCode[index][1]])
    let ret = (String.fromCharCode(arrCode[index][0]).concat(String.fromCharCode(arrCode[index][1]))).toLowerCase();
    return ret.replace('@', '#').replace('@', '#');
}

// Returns the minimum value of arr (excluding the -1 which is the delimeter)
function myMin(arr) {
    mymin = 1234568;
    arr.forEach(function (val) {
        if (!isOutlier(val)) {
            if (val < mymin) mymin = val;
        }
    })
    return mymin;
}

// Returns the maximum value of arr (excluding the outliers)
function myMax(arr) {
    mymax = -1;
    arr.forEach(function (val) {
        if (!isOutlier(val)) {
            if (val > mymax) mymax = val;
        }
    })
    return mymax;
}

// Checks if a number is an outlier
function isOutlier(num) {
    const LOWER_OUTLIER_THRESH = 10;
    const UPPER_OUTLIER_THRESH = 10000;
    return ((num < LOWER_OUTLIER_THRESH) || (num > UPPER_OUTLIER_THRESH))
}