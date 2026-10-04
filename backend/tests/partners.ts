import type { Agent } from 'supertest';

// Shared by the order and delivery tests. Not a test file itself (the runner only picks up *.test.ts).
export const header = { 'X-GreenFarm-Request': 'true' };
export const partnerPassword = 'Rider-pass-123';
let phoneSuffix = 1000;
/** A complete application. Each call gets its own phone number, since phones can't be shared between partners. */
export const application = (email: string, fullName = 'Yaw Rider') => ({
  fullName, email, phone: `020111${phoneSuffix++}`, dateOfBirth: '1994-03-12', region: 'Greater Accra', city: 'Accra', address: '7 Ring Road',
  digitalAddress: 'ga-123-4567', transportType: 'motorbike', vehicleType: 'Honda Ace 125', vehicleRegistration: 'gr 1234-20', licenseNumber: 'dl-55555',
  idType: 'ghana-card', idNumber: 'GHA-123456789-0', emergencyContactName: 'Akosua Rider', emergencyContactPhone: '0207654321', availability: 'full-time',
});

/** Applies without any customer account, has management approve, then activates, leaving `agent` signed in. Returns the partner ID. */
export async function becomePartner(admin: Agent, agent: Agent, email: string, fullName: string) {
  const { application: created, reference } = (await agent.post('/api/delivery/application').set(header).send(application(email, fullName)).expect(201)).body;
  await admin.patch(`/api/admin/delivery/applications/${created._id}/status`).set(header).send({ status: 'Approved' }).expect(200);
  await agent.post('/api/delivery/activate').set(header).send({ email, reference, password: partnerPassword }).expect(200);
  return created._id as string;
}
