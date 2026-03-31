import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import {
  AddressIdParamSchema,
  CreateAddressBodySchema,
  UpdateAddressBodySchema,
  AddressPublicSchema,
  AddressListResponseSchema,
  type CreateAddressBody,
  type UpdateAddressBody,
} from './schemas/address.schemas';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user addresses (max 3)' })
  @Validate({
    response: { schema: AddressListResponseSchema, stripUnknownProps: true },
  })
  findAll(@CurrentUser() currentUser: UserPublic) {
    return this.addressesService.findAll(currentUser.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new address (auto-primary if first)' })
  @Validate({
    request: [{ type: 'body', schema: CreateAddressBodySchema }],
    response: { schema: AddressPublicSchema, stripUnknownProps: true },
  })
  create(dto: CreateAddressBody, @CurrentUser() currentUser: UserPublic) {
    return this.addressesService.create(currentUser.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing address fields' })
  @Validate({
    request: [
      { name: 'id', type: 'param', schema: AddressIdParamSchema },
      { type: 'body', schema: UpdateAddressBodySchema },
    ],
    response: { schema: AddressPublicSchema, stripUnknownProps: true },
  })
  update(
    @Param('id') id: string,
    dto: UpdateAddressBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.addressesService.update(currentUser.id, id, dto);
  }

  @Patch(':id/primary')
  @ApiOperation({
    summary: 'Set an address as primary (demotes previous primary)',
  })
  @Validate({
    request: [{ name: 'id', type: 'param', schema: AddressIdParamSchema }],
    response: { schema: AddressPublicSchema, stripUnknownProps: true },
  })
  setPrimary(@Param('id') id: string, @CurrentUser() currentUser: UserPublic) {
    return this.addressesService.setPrimary(currentUser.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an address (auto-promotes another if primary)',
  })
  @Validate({
    request: [{ name: 'id', type: 'param', schema: AddressIdParamSchema }],
  })
  remove(@Param('id') id: string, @CurrentUser() currentUser: UserPublic) {
    return this.addressesService.remove(currentUser.id, id);
  }
}
