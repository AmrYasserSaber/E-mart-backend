import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeLegacySellerRoles1776200000000 implements MigrationInterface {
  name = 'NormalizeLegacySellerRoles1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users" u
      SET "role" = 'user'
      FROM "sellers" s
      WHERE u."id" = s."userId"
        AND u."role" = 'seller'
        AND s."status" IN ('pending', 'rejected')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort rollback: restore seller role for rows affected by this migration criteria.
    await queryRunner.query(`
      UPDATE "users" u
      SET "role" = 'seller'
      FROM "sellers" s
      WHERE u."id" = s."userId"
        AND u."role" = 'user'
        AND s."status" IN ('pending', 'rejected')
    `);
  }
}
