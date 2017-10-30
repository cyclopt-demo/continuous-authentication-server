import { Component, OnInit, AfterViewInit, Input, OnDestroy } from '@angular/core';
declare var Chart: any;

@Component({
  selector: 'app-view-gmm-data-plots',
  templateUrl: './view-gmm-data-plots.component.html',
  styleUrls: ['./view-gmm-data-plots.component.css']
})
export class ViewGmmDataPlotsComponent implements OnInit, AfterViewInit, OnDestroy {

  // flag used to tell that gauss is ready
  gaussCanvasIsReady = false;

  @Input() model: any; // the gmm model given as input
  N_COMPONENTS: number
  COLORS = ['rgba(255, 0, 0, 1)', 'rgba(34, 34, 255, 1)', 'rgba(0, 255, 0, 1)'] // red blue green
  COMP_TITLE = ['#1 Component:', '#2 Component:', '#3 Component:']
  XLABELS_INTERVAL = 30; // in millisecconds
  POINT_COLOR_DEFAULT = 'rgba(5, 5, 5, 0.75)'; // transparent black
  /**
   * Gaussian Curves stuff for canvas
   */
  defCanvasWidth = 1150;
  defCanvasHeight = 600;
  mydata1 = {
    labels: [], // labels in x axis are calculated later based on min and max
    // xBegin: 10,
    // xEnd: 600,
    datasets: []
  }
  opt1 = {
    canvasBorders: true,
    canvasBordersWidth: 3,
    canvasBordersColor: 'grey',
    graphTitle: '', // calc later,
    graphTitleFontSize: 20,
    legend: true,
    legendBlockSize: 30,
    legendFontSize: 16,
    legendPosX: -2, // middle of canvas
    legendPosY: 1, // top of canvas
    maxLegendCols: 1,
    datasetFill: false,
    annotateDisplay: true,
    pointDot: true,
    pointDotRadius: 4,
    animationLeftToRight: true,
    animationEasing: 'linear',
    yAxisMinimumInterval: 0.00002,
    yAxisLabel: 'Frequency (x 1000)',
    xAxisLabel: 'Digraph Timings (ms)',
    datasetStrokeWidth: 7,
    showSingleLegend : true
  }
  /**/
  // strokeColor: this.COLORS[0],
  // data: [],
  // xPos: [],
  // title: this.COMP_TITLE[0]

  constructor() { }

  ngOnDestroy() {
    console.log('I am child and im destroyed');
  }

  ngOnInit() {
    console.log('~~~~~~~~~~From gmm-data-plot:')
    console.log(this.model);
    console.log('\n\n');
    this.initCanvasStuff();
    this.initDatasets();
    this.computeGauss();
    this.gaussCanvasIsReady = true;
  }

  ngAfterViewInit() {
    if (this.gaussCanvasIsReady) {
      this.drawGauss();
    } else {
      // try again later...
      const that = this;
      setTimeout(function () { that.drawGauss() }, 50);
    }

  }

  /**
   * Initializes labels based on min and max
   */
  initCanvasStuff() {
    this.opt1.graphTitle = 'Gaussian Distributions for Digraph: "' + this.model.digraph + '"';
    this.mydata1.labels.push(this.model.data[0]); // the first element always is zero
    const myMax = this.model.data[this.model.data.length - 1];
    while (true) {
      const p = this.mydata1.labels[this.mydata1.labels.length - 1] + this.XLABELS_INTERVAL;
      this.mydata1.labels.push(p);
      if (p >= myMax) {
        break;
      }
    }
  }

  /**
   * Initializes Datasets with empty objects and colors and titles
   */
  initDatasets() {
    this.N_COMPONENTS = this.model.means.length;
    this.mydata1.datasets = new Array<Object>(this.N_COMPONENTS).fill({});
    for (let i = 0; i < this.mydata1.datasets.length; i++) {
      this.mydata1.datasets[i] = {
        pointColor: this.POINT_COLOR_DEFAULT,
        pointStrokeColor: this.POINT_COLOR_DEFAULT,
        strokeColor: this.COLORS[i],
        // tslint:disable-next-line:max-line-length
        title: this.COMP_TITLE[i] + String(' μ = ' + String(Math.round(this.model.means[i])) + ', σ = ' + String(Math.round(this.model.stds[i])) + ', w = ' + this.model.weights[i].toFixed(2)),
        data: [], xPos: []
      };
    }
  }

  /**
   * Computes Gauss data and xpositions according to labels
   */
  computeGauss() {

    for (let i = 0; i < this.model.data.length; i++) {

      const thisLabel = this.model.labels[i];
      const thisXposData = this.model.data[i];
      const thisGaussVar = this.model.covs[thisLabel];
      const thisGaussMean = this.model.means[thisLabel];

      this.mydata1.datasets[thisLabel].xPos.push(thisXposData);
      this.mydata1.datasets[thisLabel].data
        // tslint:disable-next-line:max-line-length
        .push((1 / (thisGaussVar * Math.sqrt(2 * Math.PI))) * Math.exp(- (1 / (2 * thisGaussVar)) * Math.pow((thisXposData - thisGaussMean), 2)));

    }

    console.log(this.mydata1.datasets);



  }

  /**
   *
   */
  drawGauss() {
    // Check if the length of datasets are >1 (this means that there is not some dataset with some gaussian with just one sample!)
    for (let i = 0; i < this.mydata1.datasets.length; i++) {
      if (this.mydata1.datasets[i].data.length === 1) {
        this.mydata1.datasets[i].data = [0];
        this.mydata1.datasets[i].title = this.COMP_TITLE[i] + ' (One Point) '
      }
    }
    const myLine = new Chart((<HTMLCanvasElement>document.getElementById('canvas_Line1')).getContext('2d')).Line(this.mydata1, this.opt1);
  }
}
