import { ActivatedRoute, Router } from '@angular/router';
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { UserService } from '../_services/user.service';
import { AlertService } from '../_services/alert.service';
import { AdminDashboard } from '../_models/admin_dashboard';
declare var jQuery: any;

@Component({
  selector: 'app-view-project',
  templateUrl: './view-project.component.html',
  styleUrls: ['./view-project.component.css']
})
export class ViewProjectComponent implements OnInit, AfterViewInit {

  _projectId: any; // This is the id in which we will send queries to the back-end
  currentProject: any; // This is the current project clicked before
  dashboardData = new AdminDashboard(); // The sucjets data

  currentProjectSiteURL_backup = ''; // used as backup in case of cancel at site url edit
  // Flags

  activateSiteURLInputFlag = false;
  dashboardLoadingFlag = true; // is true at start
  trainLoadingFlag = false;
  projectChangingFlag = false;
  onProjectSettingsChangeFlag = false;


  // How many untrained
  untrained = 0;

  // Sliders etc
  trainingDtRange = [1, 1];
  myTimeOut: any;
  mouseUpFlag = true;

  // Tool tips
  tooltips = {
      training_range: 'The training will be applied only in the specified range. All the other values will be considered outliers.',
      min_digraph_samples: 'The minimum samples required for each digraph, in order to train with GMM.',
      authentication_threshold: 'This threshold is used in authentication procedure. Higher threshold means more strict authentication.',
      keystroke_collect_period: 'Set how often (per how many digraphs typed) should the logging script send data to the server for collect/authentication.'
  }

  constructor(private alertService: AlertService, private router: Router,
            private route: ActivatedRoute, private userService: UserService) { }


  /**
   * Extracts the id project frmo the url
   * Loads the project from session storage
   * Get the dashboard-data of subjects from back-end
   */
  ngOnInit() {

    this.currentProject = JSON.parse(sessionStorage.getItem('currentProject')); // load project
    sessionStorage.removeItem('currentProject');
    this.route.params.subscribe(params => {
      this._projectId = params['id'];
    }); // load project-id (redundant)
    this.loadDashboardData();

    this.setTrainingSlider();
    this.setLastTrainDate();

    // ~~~~~~~~ DEBUGGING
      // this.currentProject = {
      //       _id: 1235,
      //       date: new Date().toLocaleString(),
      //       siteurl: 'www.lol.com',
      //       track_code: '53456657',
      //       // last_train_date:
      //       enable_keyguard_auth_flag: true,
      //       testing_threshold: 0.6,
      //       training_n_components: 2,
      //       training_outlier_min_dt: 15,
      //       training_outlier_max_dt: 1000,
      //       training_digraph_min_samples: 25,
      //       keystroke_code_collect_limit: 30
      // }
      // this.dashboardData.totalUsers_genStat = 10;
      // this.dashboardData.totalSessions_genStat = 20;
      // this.dashboardData.totalKeystrokes_genStat = 12312;
      // this.dashboardData.latestSession_genStat =  this.formatMyDate(new Date('2017-10-06T09:05:57.228Z'));
      // this.dashboardData.totalRejections_genStat = 4;
      // let tempobj =
      //   {id: 'abc12',total_keystrokes:3000,is_trained:false, min: 30,max:1000,avg:50,std:130,fastest_di:'ak',slowest_di:'fe',rejections:0};
      // this.dashboardData.userStatistics.push(tempobj);
      // tempobj =
      //   {id:'fdsf23',min:50,total_keystrokes:240,is_trained:true,max:200,avg:10,std:730,fastest_di:'ok',slowest_di:'mb',rejections:2};
      // this.dashboardData.userStatistics.push(tempobj);
      // this.untrained = 1;
    // ~~~~~~~~~~~~~~~~~

  }

  /** Enables tolltips
   *
   */
  ngAfterViewInit() {
    setTimeout(function(){
      jQuery('[data-toggle="tooltip"]').tooltip();
    }, 2000);
  }

   /**
   * Gets the user id from local storage
   */
  getUserIdFromLocalStorage() {
    // Get the current user from local storage
    const localStor = JSON.parse(localStorage.getItem('currentUser'));
    if (!localStor) {
        alert('You are not logged in');
        this.router.navigate(['/login']);
    }else {
       return localStor._id;
    }
  }

  /**
   * Get the dashboard data from subjects from back-end wrapper
   */
  loadDashboardData() {
    const user_id = this.getUserIdFromLocalStorage();
    this.userService.loadDashboardData(user_id, this._projectId).subscribe(
      data => {
          if (data.success) {
              this.dashboardLoadingFlag = false;
              this.dashboardData = data.dashboardData;
              // Parse dates
              this.dashboardData.latestSession_genStat = this.formatMyDate(data.dashboardData.latestSession_genStat);
              // Calc how many are untrained
              this.howManyAreUntrained();
          }else {
            if (data.val === 'no-subjects') {
              window.scrollTo(0, 0);
              this.alertService.warn('Heads Up: You don\'t have any dashboard data yet!', false, 2500);
              this.dashboardLoadingFlag = false;
            }else {
              this.alertService.error(data.message, false, 3000);
              window.scrollTo(0, 0);
            }

          }
      });
  }

  /**
   * Train project
   */
  train() {

      const user_id = this.getUserIdFromLocalStorage();

      this.trainLoadingFlag = true;

      this.currentProject.training_outlier_min_dt = this.trainingDtRange[0];
      this.currentProject.training_outlier_max_dt = this.trainingDtRange[1];
      const training_settings = {
          training_outlier_min_dt: Number(this.currentProject.training_outlier_min_dt),
          training_outlier_max_dt: Number(this.currentProject.training_outlier_max_dt),
          training_n_components: Number(this.currentProject.training_n_components),
          training_digraph_min_samples: Number(this.currentProject.training_digraph_min_samples)
      }

      this.userService.train(user_id, this._projectId, training_settings).subscribe(
        data => {
          if (data.success) {
              this.trainLoadingFlag = false;
              console.log(data);
              window.scrollTo(0, 0);
              this.alertService.success(data.message, false, 2500);
              this.untrained = 0;
              for (let i = 0; i < this.dashboardData.userStatistics.length; i++) {
                this.dashboardData.userStatistics[i].is_trained = true;
              }
              this.currentProject.last_train_date =  this.formatMyDate(new Date().toISOString());
            }else {
              this.trainLoadingFlag = false;
              console.log('Failed at loadDashboardData()');
              console.log(data);
              window.scrollTo(0, 0);
              this.alertService.error('ERROR: ' + data.message, false, 3000);
            }
      });

  }

  /**
   *
   */
  changeProjectSettings() {
    const user_id = this.getUserIdFromLocalStorage();
    this.projectChangingFlag = true;
    this.userService.changeProject(user_id, this._projectId, this.currentProject).subscribe(
        data => {
            if (data.success) {
                this.onProjectSettingsChangeFlag = false;
                this.projectChangingFlag = false;
                this.activateSiteURLInputFlag = false;
                if (data.track_code_changed_flag) {
                  this.currentProject.track_code = data.project.track_code;
                }
                window.scrollTo(0, 0);
                this.alertService.success(data.message, false, 2500);
            }else {
                this.onProjectSettingsChangeFlag = false;
                this.projectChangingFlag = false;
                console.log(data);
                window.scrollTo(0, 0);
                this.alertService.error('ERROR: ' + data.message, false, 3000);
            }
        });
  }

  /**
   * Toggle
   */
  toggleKeyguardAuthFlag() {
    this.currentProject.enable_keyguard_auth_flag = !this.currentProject.enable_keyguard_auth_flag;
  }

  /**
   * Delete All Subjects Data
   */
  deleteSubjects() {
    if (confirm('Are you sure?')) {
      const user_id = this.getUserIdFromLocalStorage();
      this.projectChangingFlag = true;
      this.userService.deleteSubjectsData(user_id, this._projectId).subscribe(
        data => {
          if (data.success) {
            this.projectChangingFlag = false;
            window.scrollTo(0, 0);
            this.alertService.success(data.message, false, 2500);
        }else {
            this.projectChangingFlag = false;
            console.log(data);
            window.scrollTo(0, 0);
            this.alertService.error('ERROR: ' + data.message, false, 3000);
        }
        }
      );
    }
  }

  /**
   * Delete one subject's data
   */
  deleteSubjectData(index) {
      if (confirm('Are you sure?')) {

        const subject_id = this.dashboardData.userStatistics[index].id;
        const user_id = this.getUserIdFromLocalStorage();

        this.userService.deleteSubjectData(user_id, subject_id, this._projectId).subscribe(
            data => {
                if (data.success) {
                    if (data.train_date_reset) {
                        this.dashboardData = new AdminDashboard(); // clear it
                        this.currentProject.lastTrainDate_genStat = '';
                        window.scrollTo(0, 0);
                        this.alertService.success('Subject deleted succesfully!', false, 1500);
                        this.alertService.warn('Heads up you do not have any subjects data yet!', false, 2500);
                    }else {
                        this.dashboardLoadingFlag = true;
                        this.dashboardData = new AdminDashboard();
                        this.loadDashboardData();
                        window.scrollTo(0, 0);
                        this.alertService.success('Subject deleted succesfully!', false, 2500);
                    }
                }else {
                    window.scrollTo(0, 0);
                    this.alertService.error(data.message, false, 3000);
                }
            });
      }
  }

  /**
   * Download one subjects data
   */
  downloadSubjectsData(index) {

    const user_id = this.getUserIdFromLocalStorage();
    const subject_id = this.dashboardData.userStatistics[index].id;
    this.userService.downloadSubjectsData(user_id, subject_id, this._projectId);

  }


  /**
   * Sets training slider
   */
  setTrainingSlider() {
     this.trainingDtRange[0] = this.currentProject.training_outlier_min_dt;
     this.trainingDtRange[1] = this.currentProject.training_outlier_max_dt;
  }
  /**
   *
   */
  setLastTrainDate() {
    if (this.currentProject.last_train_date !== undefined && this.currentProject.last_train_date !== '' ) {
      this.currentProject.last_train_date   = this.formatMyDate(this.currentProject.last_train_date);
    }else {
      this.currentProject.last_train_date = ''
    }
  }

  /** Calcs how many untrained
   *
   */
  howManyAreUntrained() {
    for (let i = 0; i < this.dashboardData.userStatistics.length; i++) {
        if (this.dashboardData.userStatistics[i].is_trained === false) {
            this.untrained++;
        }
    }
  }

  /**
   *
   */
   outlierRangeIncreaseDecreaseWrapper(min_bool, up_bool, offset = 1) {
        if (min_bool) {
            const tmpMax = this.trainingDtRange[1];
            let tmpMin = this.trainingDtRange[0] - offset;
            if (up_bool) { tmpMin = tmpMin + (2 * offset); }
            this.trainingDtRange = [tmpMin, tmpMax];
        }else {
            const tmpMin = this.trainingDtRange[0];
            let tmpMax = this.trainingDtRange[1] - offset;
            if (up_bool) { tmpMax = tmpMax + (2 * offset); }
            this.trainingDtRange = [tmpMin, tmpMax];
        }
  }

  /**
   * Format date
   */
  formatMyDate(myDate) {
    const d = new Date(myDate);
    return d.toLocaleString().substr(0, 10).concat(', ' + d.toTimeString().substr(0, 5));
  }

}
