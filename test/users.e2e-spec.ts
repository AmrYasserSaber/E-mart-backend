import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Role } from '../src/common/enums/role.enum';
import { configureNestJsTypebox } from 'nestjs-typebox';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;

  beforeAll(async () => {
    configureNestJsTypebox({
      patchSwagger: false,
      setFormats: true,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'postgres',
          database: process.env.DB_NAME || 'emart_test',
          entities: [User, RefreshToken],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    refreshTokenRepository = moduleFixture.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await refreshTokenRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  /**
   * Creates and persists a user with the given email and role, then logs in to obtain an access token.
   *
   * @param email - Email address for the created user
   * @param role - Role assigned to the user; when `Role.ADMIN` the user's `firstName` will be set to "Admin", otherwise "Regular"
   * @returns An object containing the persisted `user` entity and the `accessToken` returned by the authentication endpoint
   */
  async function createUser(
    email: string,
    role: Role = Role.USER,
  ): Promise<{ user: User; accessToken: string }> {
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = await userRepository.save({
      firstName: role === Role.ADMIN ? 'Admin' : 'Regular',
      lastName: 'User',
      email,
      passwordHash,
      role,
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });

    return { user, accessToken: loginResponse.body.access_token };
  }

  describe('GET /users/:id', () => {
    it('should return user data when requested by admin', async () => {
      const { user: targetUser } = await createUser(
        'target@example.com',
        Role.USER,
      );
      const { accessToken: adminToken } = await createUser(
        'admin@example.com',
        Role.ADMIN,
      );

      const response = await request(app.getHttpServer())
        .get(`/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(targetUser.id);
      expect(response.body.email).toBe('target@example.com');
      expect(response.body.firstName).toBe('Regular');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 403 when requested by regular user', async () => {
      const { user: targetUser } = await createUser(
        'target@example.com',
        Role.USER,
      );
      const { accessToken: userToken } = await createUser(
        'user@example.com',
        Role.USER,
      );

      await request(app.getHttpServer())
        .get(`/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const { user } = await createUser('target@example.com', Role.USER);

      await request(app.getHttpServer()).get(`/users/${user.id}`).expect(401);
    });

    it('should return 404 for non-existent user', async () => {
      const { accessToken: adminToken } = await createUser(
        'admin@example.com',
        Role.ADMIN,
      );

      await request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should allow admin to view their own profile', async () => {
      const { user: admin, accessToken: adminToken } = await createUser(
        'admin@example.com',
        Role.ADMIN,
      );

      const response = await request(app.getHttpServer())
        .get(`/users/${admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(admin.id);
      expect(response.body.email).toBe('admin@example.com');
    });
  });
});
