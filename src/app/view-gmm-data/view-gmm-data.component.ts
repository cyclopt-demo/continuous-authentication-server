import { Component, OnInit, ViewChild } from '@angular/core';
import { UserService } from '../_services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertService } from '../_services/alert.service';
import { PageScrollConfig, PageScrollService, PageScrollInstance } from 'ng2-page-scroll';

@Component({
  selector: 'app-view-gmm-data',
  templateUrl: './view-gmm-data.component.html',
  styleUrls: ['./view-gmm-data.component.css']
})
export class ViewGmmDataComponent implements OnInit {


  // View COmponent Stuff
  DATA_PER_ROW = 12; // default for lg, md, sm, xs
  di_gmms = [];
  di_gmms_loading_flag = true;
  subject_id: string;

  // Stuff to load view-gmm-data-plots component
  diGMMIndexToPlot = -1;

  constructor(
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService,
    private pageScrollService: PageScrollService) { }

  ngOnInit() {

    // Get Subject-id
    this.route.params.subscribe(params => {
      this.subject_id = params['id'];
      this.loadGMMDataFromServer();
    });


    // this.loadFakeDataDebugging();
    // console.log(this.di_gmms);
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
    } else {
      return localStor._id;
    }
  }

  /** !!!!!!!!!!!!!!!!1UNTESTED!!!!!!!!!!!!!!!!!!!!!!!
   * Loads the gmm data from the server
   */
  loadGMMDataFromServer() {
    const user_id = this.getUserIdFromLocalStorage();
    this.userService.getSubjectsGMMData(user_id, this.subject_id).subscribe(
      data => {
        if (data.success) {
          this.di_gmms_loading_flag = false;
          this.di_gmms = data.di_gmms;
          console.log(this.di_gmms);
        } else {
          this.di_gmms_loading_flag = false;
          console.log(data);
          this.alertService.error(data.message, false, 3000);
          window.scrollTo(0, 0);
        }
      });
  }

  /**
   * Starts Graph Component
   */
  loadDigraphGraphComponent(digraph) {
    console.log('Loading Graph Component for digraph:' + digraph);

    if (this.diGMMIndexToPlot > -1) {
      this.diGMMIndexToPlot = -1;
      const that = this;
      setTimeout(function () {
        const index = that.getIndexFromDigraph(digraph);
        if (index > -1) {
          that.diGMMIndexToPlot = index;
          setTimeout(function () {
            const pageScrollInstance: PageScrollInstance = PageScrollInstance.newInstance(
              { document: document, scrollTarget: '#gmm-plot-id', pageScrollDuration: 500 });
            that.pageScrollService.start(pageScrollInstance);
          }, 100)
        } else {
          console.log('error in finding index')
        }
      }, 200) // give some time for child to destroy it self
    } else {
      const index = this.getIndexFromDigraph(digraph);
      if (index > -1) {
        this.diGMMIndexToPlot = index;
        const that = this;
        setTimeout(function () {
          const pageScrollInstance: PageScrollInstance = PageScrollInstance.newInstance(
            { document: document, scrollTarget: '#gmm-plot-id', pageScrollDuration: 500 });
          that.pageScrollService.start(pageScrollInstance);
        }, 100)

        // scroll to
      } else {
        console.log('error in finding index')
      }
    }



  }

  /**
   * Gets index from digraph by searching inside the json array obj
   */
  getIndexFromDigraph(digraph) {
    for (let i = 0; i < this.di_gmms.length; i++) {
      if (this.di_gmms[i].digraph === digraph) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Loads fake data for debugging purposes
   */
  loadFakeDataDebugging() {
    this.subject_id = 'abc123123';
    const count = 500; // max 27*27 = 729 (edw ksekinaw apto aa alla kanonika ksekinw apo ##)
    const chr = ['a', 'a'];
    let tmp;
    for (let i = 0; i < count; i++) {
      tmp = {
        'digraph': chr[0] + chr[1],
        '_id': '59f4598579106500047feb47',
        'stds': [35.111039666407855, 74.19166069204753],
        'covs': [1232.7851064560657, 5504.402516243911],
        'means': [121.17748239975265, 274.0135163532821],
        'weights': [0.9068491706683394, 0.09315082933166054],
        'labels': [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          1,
          1
        ],
        'data': [
          20,
          51,
          56,
          71,
          74,
          82,
          82,
          87,
          88,
          90,
          91,
          93,
          93,
          94,
          94,
          95,
          97,
          97,
          97,
          99,
          99,
          104,
          105,
          108,
          108,
          109,
          109,
          109,
          112,
          121,
          121,
          121,
          121,
          123,
          126,
          126,
          127,
          127,
          128,
          129,
          131,
          136,
          137,
          141,
          142,
          142,
          142,
          144,
          151,
          152,
          153,
          154,
          155,
          158,
          160,
          163,
          163,
          165,
          171,
          174,
          175,
          177,
          179,
          203,
          209,
          251,
          263,
          298,
          298,
          408
        ]
      }
      this.di_gmms.push(tmp);
      chr[1] = String.fromCharCode(chr[1].charCodeAt(0) + 1);
      if (chr[1].charCodeAt(0) > 122) { // > 'z'
        chr[1] = 'a';
        chr[0] = String.fromCharCode(chr[0].charCodeAt(0) + 1);
      }
    }
  }

}
