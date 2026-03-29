import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ValidateQueryParams } from '../common/decorators/validate-query-params.decorator';
import {
  ListUsersQuerySchema,
  type ListUsersQuery,
  ListUsersResponseSchema,
  ManageUserBodySchema,
  type ManageUserBody,
  ManageUserResponseSchema,
  ListAdminOrdersQuerySchema,
  type ListAdminOrdersQuery,
  ListAdminOrdersResponseSchema,
  ManageOrderStatusBodySchema,
  type ManageOrderStatusBody,
  ManageOrderStatusResponseSchema,
} from './schemas/admin.schemas';
import { UserPublicSchema } from '../users/schemas/user.schema';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ValidateQueryParams(ListUsersQuerySchema)
  @Validate({
    response: { schema: ListUsersResponseSchema, stripUnknownProps: true },
  })
  listUsers(@Query() query: ListUsersQuery) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get single user by id' })
  @ApiParam({ name: 'id', type: String })
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Manage user role/active status' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({
    description: 'Updated user account',
    schema: UserPublicSchema,
  })
  @Validate({
    request: [{ type: 'body', schema: ManageUserBodySchema }],
    response: { schema: ManageUserResponseSchema, stripUnknownProps: true },
  })
  manageUser(
    @Body() dto: ManageUserBody,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminService.manageUser(id, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ValidateQueryParams(ListAdminOrdersQuerySchema)
  @Validate({
    response: {
      schema: ListAdminOrdersResponseSchema,
      stripUnknownProps: true,
    },
  })
  listOrders(@Query() query: ListAdminOrdersQuery) {
    return this.adminService.listOrders(query);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update order status (admin)' })
  @ApiParam({ name: 'id', type: String })
  @Validate({
    request: [{ type: 'body', schema: ManageOrderStatusBodySchema }],
    response: {
      schema: ManageOrderStatusResponseSchema,
      stripUnknownProps: true,
    },
  })
  updateOrderStatus(
    @Body() dto: ManageOrderStatusBody,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminService.updateOrderStatus(id, dto);
  }
}
