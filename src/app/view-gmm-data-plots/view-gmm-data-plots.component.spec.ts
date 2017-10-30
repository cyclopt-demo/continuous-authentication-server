import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewGmmDataPlotsComponent } from './view-gmm-data-plots.component';

describe('ViewGmmDataPlotsComponent', () => {
  let component: ViewGmmDataPlotsComponent;
  let fixture: ComponentFixture<ViewGmmDataPlotsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ViewGmmDataPlotsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewGmmDataPlotsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
