import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAddresses1774957198223 implements MigrationInterface {
  name = 'CreateAddresses1774957198223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "label" character varying(50), "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "phone" character varying(30), "street" character varying(200) NOT NULL, "city" character varying(100) NOT NULL, "isPrimary" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab065210f1573" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_745d8f43d3af10ab065210f157" ON "addresses" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_745d8f43d3af10ab065210f157_2" ON "addresses" ("userId", "isPrimary") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_addresses_user_primary" ON "addresses" ("userId") WHERE "isPrimary" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "addresses" ADD CONSTRAINT "FK_745d8f43d3af10ab065210f1573" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "addresses" DROP CONSTRAINT "FK_745d8f43d3af10ab065210f1573"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_addresses_user_primary"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_745d8f43d3af10ab065210f157_2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_745d8f43d3af10ab065210f157"`,
    );
    await queryRunner.query(`DROP TABLE "addresses"`);
  }
}
