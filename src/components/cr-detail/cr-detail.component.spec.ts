import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('renders diff rows with the right kind for each SKU', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const rows = Array.from(fixture.nativeElement.querySelectorAll('.cr-diff__row')) as HTMLElement[];
		expect(rows.map((r) => [r.children[0].textContent, r.getAttribute('data-kind')])).toEqual([
			['SKU-A', 'changed'],
			['SKU-B', 'unchanged'],
		]);
	});

	it('renders the totals and the delta', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const totals = fixture.nativeElement.querySelector('.cr-detail__totals').textContent;
		expect(totals).toContain('USD 8,000.00');
		expect(totals).toContain('USD 8,500.00');
		expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain('USD 500.00');
	});

	it('renders the timeline oldest first', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const actions = Array.from(fixture.nativeElement.querySelectorAll('.cr-timeline__action')).map((e) => (e as HTMLElement).textContent);
		expect(actions).toEqual(['CREATE', 'SUBMIT', 'SEND_FOR_APPROVAL']);
	});

	it('offers enabled Approve and Reject to an approver on a pending CR', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const approve: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approve.disabled).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).not.toBeNull();
	});

	it('hides the reject form from a read-only viewer', async () => {
		const fixture = await render(users.viewer, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('does not allow actions on a CR that is not pending, even for an approver', async () => {
		const fixture = await render(users.approver, 'CR-2'); // APPLIED
		const approve: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approve.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('shows an error and recovers on Retry when loading fails', async () => {
		TestBed.configureTestingModule({
			imports: [CrDetailComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }],
		});
		TestBed.inject(CrApiService).failNext = true;
		const fixture = TestBed.createComponent(CrDetailComponent);
		fixture.componentInstance.id = 'CR-1';
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Network error');

		fixture.nativeElement.querySelector('.cr-detail__error button').click();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('shows an error when the CR belongs to another org', async () => {
		const fixture = await render(users.otherOrg, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Not found');
	});

	describe('actions', () => {
	const q = (fixture: ComponentFixture<CrDetailComponent>, sel: string) => fixture.nativeElement.querySelector(sel);
	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

	it('approve updates the status, adds a timeline entry and removes the actions', async () => {
		const fixture = await render(users.approver, 'CR-1');
		q(fixture, '.cr-actions__approve').click();
		await flush();
		fixture.detectChanges();
		expect(q(fixture, '.cr-status').textContent).toContain('APPROVED');
		const actions = Array.from(fixture.nativeElement.querySelectorAll('.cr-timeline__action')).map((e) => (e as HTMLElement).textContent);
		expect(actions[actions.length - 1]).toBe('APPROVE');
		expect(q(fixture, '.cr-actions__approve').disabled).toBe(true);
		expect(q(fixture, '.cr-actions__reject')).toBeNull();
	});

	it('disables the buttons while a slow approve is pending and calls the API only once on a double click', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const api = TestBed.inject(CrApiService);
		const spy = jest.spyOn(api, 'approve');
		api.latencyMs = 30;

		const btn: HTMLButtonElement = q(fixture, '.cr-actions__approve');
		btn.click();
		btn.click();
		fixture.detectChanges();
		expect(btn.disabled).toBe(true);
		expect(q(fixture, '.cr-actions__reject-btn').disabled).toBe(true);
		expect(q(fixture, '.cr-status').textContent).toContain('PENDING_APPROVAL'); // no optimistic update

		await wait(60);
		fixture.detectChanges();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(q(fixture, '.cr-status').textContent).toContain('APPROVED');
	});

	it('shows an error and keeps the CR actionable when approve fails', async () => {
		const fixture = await render(users.approver, 'CR-1');
		TestBed.inject(CrApiService).failNext = true;
		q(fixture, '.cr-actions__approve').click();
		await flush();
		fixture.detectChanges();
		expect(q(fixture, '.cr-actions__error').textContent).toContain('Network error');
		expect(q(fixture, '.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect(q(fixture, '.cr-actions__approve').disabled).toBe(false);
	});

	it('keeps Reject disabled until a reason is typed', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const rejectBtn: HTMLButtonElement = q(fixture, '.cr-actions__reject-btn');
		expect(rejectBtn.disabled).toBe(true);

		fixture.componentInstance.rejectControl.setValue('   ');
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(true);

		fixture.componentInstance.rejectControl.setValue('Too expensive');
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(false);
	});

	it('does not call the API and shows the validation message when rejecting without a reason', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const spy = jest.spyOn(TestBed.inject(CrApiService), 'reject');
		await fixture.componentInstance.reject();
		fixture.detectChanges();
		expect(spy).not.toHaveBeenCalled();
		expect(q(fixture, '.cr-actions__reason-error')).not.toBeNull();
	});

	it('reject sends the trimmed reason and shows it in the timeline', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const spy = jest.spyOn(TestBed.inject(CrApiService), 'reject');
		fixture.componentInstance.rejectControl.setValue('  Too expensive  ');
		fixture.detectChanges(); // re-render so the Reject button becomes enabled
		q(fixture, '.cr-actions__reject-btn').click();
		await flush();
		fixture.detectChanges();
		expect(spy).toHaveBeenCalledWith(users.approver, 'CR-1', expect.any(String), 'Too expensive');
		expect(q(fixture, '.cr-status').textContent).toContain('REJECTED');
		expect(q(fixture, '.cr-timeline__note').textContent).toContain('Too expensive');
		expect(q(fixture, '.cr-actions__reject')).toBeNull();
	});

	it('keeps the typed reason and shows an error when reject fails', async () => {
		const fixture = await render(users.approver, 'CR-1');
		TestBed.inject(CrApiService).failNext = true;
		fixture.componentInstance.rejectControl.setValue('Too expensive');
		fixture.detectChanges(); // re-render so the Reject button becomes enabled
		q(fixture, '.cr-actions__reject-btn').click();
		await flush();
		fixture.detectChanges();
		expect(q(fixture, '.cr-actions__error').textContent).toContain('Network error');
		expect(q(fixture, '.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect(q(fixture, '.cr-actions__reason').value).toBe('Too expensive');
		});
	});
});
