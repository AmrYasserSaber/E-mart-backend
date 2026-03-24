import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import type { UserPublic } from './entities/user.entity';
import { toUserPublic } from './entities/user.entity';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UserPublicSchema,
  UpdateProfileBodySchema,
  type UpdateProfileBody,
} from './schemas/user.schema';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    request: [{ type: 'body', schema: UpdateProfileBodySchema }],
    response: { schema: UserPublicSchema, stripUnknownProps: true },
  })
  async updateProfile(
    body: UpdateProfileBody,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<UserPublic> {
    const updated = await this.usersService.updateProfile(currentUser.id, body);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return toUserPublic(updated);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Validate({
    request: [{ type: 'body', schema: UpdateProfileBodySchema }],
    response: { schema: UserPublicSchema, stripUnknownProps: true },
  })
  async updateUser(
    body: UpdateProfileBody,
    @Param('id') id: string,
  ): Promise<UserPublic> {
    const updated = await this.usersService.updateProfile(id, body);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return toUserPublic(updated);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async findOne(@Param('id') id: string): Promise<UserPublic> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserPublic(user);
  }
}
