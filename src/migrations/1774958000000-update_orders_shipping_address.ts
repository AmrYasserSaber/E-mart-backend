import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrdersShippingAddress1774958000000 implements MigrationInterface {
  name = 'UpdateOrdersShippingAddress1774958000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_orders_userId_users_id'
        ) THEN
          ALTER TABLE "orders"
          ADD CONSTRAINT "FK_orders_userId_users_id"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_userId" ON "orders" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingAddressId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_shippingAddressId" ON "orders" ("shippingAddressId") `,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_orders_shippingAddressId_addresses_id'
        ) THEN
          ALTER TABLE "orders"
          ADD CONSTRAINT "FK_orders_shippingAddressId_addresses_id"
          FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "shippingAddress"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "shippingAddress" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_orders_shippingAddressId_addresses_id'
        ) THEN
          ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_shippingAddressId_addresses_id";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_orders_shippingAddressId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "shippingAddressId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_orders_userId"`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_orders_userId_users_id'
        ) THEN
          ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_userId_users_id";
        END IF;
      END
      $$;
    `);
  }
}
