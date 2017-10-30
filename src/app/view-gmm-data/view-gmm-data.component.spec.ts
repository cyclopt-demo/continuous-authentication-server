import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewGmmDataComponent } from './view-gmm-data.component';

describe('ViewGmmDataComponent', () => {
  let component: ViewGmmDataComponent;
  let fixture: ComponentFixture<ViewGmmDataComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ViewGmmDataComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewGmmDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
