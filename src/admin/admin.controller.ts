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
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ListUsersDto } from './dto/list-users.dto';
import { ManageUserDto } from './dto/manage-user.dto';
import { Role } from '../common/enums/role.enum';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users for admin management' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
  })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  listUsers(@Query() query: ListUsersDto) {
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: [Role.USER, Role.SELLER, Role.ADMIN],
        },
        active: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  })
  @ApiOkResponse({
    description: 'Updated user account',
  })
  manageUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ManageUserDto,
  ) {
    return this.adminService.manageUser(id, dto);
  }
}
