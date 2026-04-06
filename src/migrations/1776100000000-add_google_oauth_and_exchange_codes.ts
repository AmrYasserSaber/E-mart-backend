import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleOauthAndExchangeCodes1776100000000 implements MigrationInterface {
  name = 'AddGoogleOauthAndExchangeCodes1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "authProvider" character varying NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "googleId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "oauth_exchange_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "returnUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_oauth_exchange_codes_codeHash" UNIQUE ("codeHash"), CONSTRAINT "PK_oauth_exchange_codes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_exchange_codes_codeHash" ON "oauth_exchange_codes" ("codeHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_exchange_codes" ADD CONSTRAINT "FK_oauth_exchange_codes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_exchange_codes" DROP CONSTRAINT "FK_oauth_exchange_codes_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_oauth_exchange_codes_codeHash"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_exchange_codes"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_googleId"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "authProvider"`);
  }
}
