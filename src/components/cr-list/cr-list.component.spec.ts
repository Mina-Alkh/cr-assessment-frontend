import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrListComponent } from './cr-list.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser): Promise<ComponentFixture<CrListComponent>> {
	TestBed.configureTestingModule({
		imports: [CrListComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrListComponent);
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded/empty state
	return fixture;
}

describe('CrListComponent', () => {
	it('renders a row per change request in the user org', async () => {
		const fixture = await render(users.approver);
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3); // org-alpha: CR-1, CR-2, CR-3
	});

	it('shows the empty state when the org has no change requests', async () => {
		const fixture = await render({ id: 'x', orgCode: 'org-empty', policies: ['cr_r_o'] });
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('shows the loading state while the API is pending', async () => {
		TestBed.configureTestingModule({
			imports: [CrListComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }],
		});
		TestBed.inject(CrApiService).latencyMs = 50;
		const fixture = TestBed.createComponent(CrListComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('shows an error and recovers on Retry', async () => {
		TestBed.configureTestingModule({
			imports: [CrListComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }],
		});
		TestBed.inject(CrApiService).failNext = true;
		const fixture = TestBed.createComponent(CrListComponent);
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();

		fixture.nativeElement.querySelector('.cr-list__error button').click();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__error')).toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});

	it('narrows the rendered rows when a status filter is chosen', async () => {
		const fixture = await render(users.approver);
		fixture.componentInstance.onFilterChange('DRAFT');
		fixture.detectChanges();
		const rows = fixture.nativeElement.querySelectorAll('.cr-list__row');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('CR-3');
		expect(fixture.componentInstance.visibleRows.length).toBe(1);
	});

	it('shows all rows again when the filter is set back to ALL', async () => {
		const fixture = await render(users.approver);
		fixture.componentInstance.onFilterChange('DRAFT');
		fixture.componentInstance.onFilterChange('ALL');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});

	it('shows a no-results message when the filter matches nothing', async () => {
		const fixture = await render(users.approver);
		fixture.componentInstance.onFilterChange('REJECTED');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(0);
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__no-results')).not.toBeNull();
	});
});
