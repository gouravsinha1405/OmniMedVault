import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

describe('OmniMedVault API (e2e)', () => {
  let app: INestApplication;
  let doctorAccessToken: string;
  let refreshToken: string;
  let patientAccessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({
      service: 'omnimedvault-api',
      status: 'ok',
    });
  });

  it('returns seeded specialties', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/specialties')
      .expect(200);

    expect(response.body).toHaveLength(22);
    expect(response.body[0]).toEqual({
      code: 'GENERAL_MEDICINE',
      displayName: 'General Medicine / GP',
      commonName: 'GP, Family Doctor',
      isActive: true,
    });
  });

  it('completes the demo OTP auth flow', async () => {
    const otpRequest = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({
        phone: '+919876543210',
        role: 'DOCTOR',
      })
      .expect(201);

    expect(otpRequest.body.sessionId).toBeDefined();
    expect(otpRequest.body.debugOtp).toHaveLength(6);
    expect(otpRequest.body.role).toBe('DOCTOR');

    const otpVerify = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        sessionId: otpRequest.body.sessionId,
        phone: '+919876543210',
        role: 'DOCTOR',
        otp: otpRequest.body.debugOtp,
      })
      .expect(201);

    expect(otpVerify.body.accessToken).toContain('demo-access-DOCTOR-');
    expect(otpVerify.body.refreshToken).toContain('demo-refresh-');
    expect(otpVerify.body.user).toEqual({
      phone: '+919876543210',
      role: 'DOCTOR',
      status: 'authenticated',
    });

    doctorAccessToken = otpVerify.body.accessToken;
    refreshToken = otpVerify.body.refreshToken;
  });

  it('refreshes and invalidates refresh tokens', async () => {
    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken })
      .expect(201);

    expect(refreshResponse.body.accessToken).toContain('demo-access-DOCTOR-');
    expect(refreshResponse.body.refreshToken).toContain('demo-refresh-');

    const rotatedRefreshToken = refreshResponse.body.refreshToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);
  });

  it('returns and updates the authenticated patient profile', async () => {
    const otpRequest = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({
        phone: '+919812345678',
        role: 'PATIENT',
      })
      .expect(201);

    const otpVerify = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        sessionId: otpRequest.body.sessionId,
        phone: '+919812345678',
        role: 'PATIENT',
        otp: otpRequest.body.debugOtp,
      })
      .expect(201);

    patientAccessToken = otpVerify.body.accessToken;

    const getProfile = await request(app.getHttpServer())
      .get('/api/v1/patients/me')
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .expect(200);

    expect(getProfile.body).toMatchObject({
      phone: '+919812345678',
      name: null,
      bloodGroup: null,
      allergies: [],
      isActive: true,
    });
    expect(getProfile.body.id).toBeDefined();

    const updatedProfile = await request(app.getHttpServer())
      .put('/api/v1/patients/me')
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .send({
        name: 'Asha Verma',
        dateOfBirth: '1993-08-11',
        gender: 'FEMALE',
        bloodGroup: 'B+',
        allergies: ['Penicillin'],
      })
      .expect(200);

    expect(updatedProfile.body).toMatchObject({
      phone: '+919812345678',
      name: 'Asha Verma',
      dateOfBirth: '1993-08-11',
      gender: 'FEMALE',
      bloodGroup: 'B+',
      allergies: ['Penicillin'],
      isActive: true,
    });
  });

  it('rejects doctor access to patient self endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/patients/me')
      .set('Authorization', `Bearer ${doctorAccessToken}`)
      .expect(403);
  });

  it('uploads, lists, reads, and prepares download for patient documents', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .field('type', 'PRESCRIPTION')
      .field('documentDate', '2026-05-28')
      .field('ocrText', 'Take one tablet after dinner')
      .attach('file', Buffer.from('demo prescription content'), {
        filename: 'prescription.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(uploadResponse.body).toMatchObject({
      patientPhone: '+919812345678',
      type: 'PRESCRIPTION',
      source: 'PATIENT_UPLOAD',
      ocrStatus: 'PENDING',
      ocrText: 'Take one tablet after dinner',
      documentDate: '2026-05-28',
      uploadedByRole: 'PATIENT',
      uploadedFileName: 'prescription.txt',
      mimeType: 'text/plain',
    });
    expect(uploadResponse.body.id).toBeDefined();

    const documentId = uploadResponse.body.id;

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .query({ type: 'PRESCRIPTION' })
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(documentId);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .expect(200);

    expect(detailResponse.body.id).toBe(documentId);
    expect(detailResponse.body.storageKey).toContain('patients/%2B919812345678/documents/');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${patientAccessToken}`)
      .expect(200);

    expect(downloadResponse.body).toEqual({
      documentId,
      fileName: 'prescription.txt',
      mimeType: 'text/plain',
      downloadUrl: `https://demo.omnimedvault.local/download/${documentId}`,
      expiresInSeconds: 900,
      storageKey: detailResponse.body.storageKey,
    });
  });
});
