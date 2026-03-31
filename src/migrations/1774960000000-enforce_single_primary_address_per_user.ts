import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSinglePrimaryAddressPerUser1774960000000 implements MigrationInterface {
  name = 'EnforceSinglePrimaryAddressPerUser1774960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
          ) AS rn
        FROM "addresses"
        WHERE "isPrimary" = true
      )
      UPDATE "addresses" a
      SET "isPrimary" = false
      FROM ranked r
      WHERE a."id" = r."id" AND r.rn > 1
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_addresses_user_primary" ON "addresses" ("userId") WHERE "isPrimary" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_addresses_user_primary"`,
    );
  }
}
