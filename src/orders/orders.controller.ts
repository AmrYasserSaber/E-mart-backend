import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  ParseUUIDPipe,
  Param,
  NotFoundException,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { OrdersService } from './orders.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  CreateOrderBodySchema,
  OrderDetailsResponse,
  OrderDetailsResponseSchema,
  OrdersListResponse,
  OrdersListResponseSchema,
  OrderResponse,
  OrderResponseSchema,
  UpdateOrderStatusBodySchema,
  UpdateOrderStatusResponse,
  UpdateOrderStatusResponseSchema,
} from './schemas/order.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Validate({
    request: [{ type: 'body', schema: CreateOrderBodySchema }],
    response: { schema: OrderResponseSchema, stripUnknownProps: true },
  })
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<OrderResponse> {
    return this.ordersService.create(currentUser.id, createOrderDto);
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard)
  @Validate({
    response: { schema: OrdersListResponseSchema, stripUnknownProps: true },
  })
  findAllForSeller(
    @CurrentUser() currentUser: UserPublic,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<OrdersListResponse> {
    const normalizedPage = page < 1 ? 1 : page;
    const normalizedLimit = limit < 1 ? 10 : Math.min(limit, 100);

    return this.ordersService.findAllForSeller(
      currentUser.id,
      normalizedPage,
      normalizedLimit,
    );
  }

  @Get('seller/:id')
  @UseGuards(JwtAuthGuard)
  @Validate({
    response: { schema: OrderDetailsResponseSchema, stripUnknownProps: true },
  })
  async findOneForSeller(
    @CurrentUser() currentUser: UserPublic,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderDetailsResponse> {
    const order = await this.ordersService.findOneForSeller(id, currentUser.id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Patch('seller/:id/status')
  @UseGuards(JwtAuthGuard)
  @Validate({
    request: [{ type: 'body', schema: UpdateOrderStatusBodySchema }],
    response: {
      schema: UpdateOrderStatusResponseSchema,
      stripUnknownProps: true,
    },
  })
  updateStatusForSeller(
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() currentUser: UserPublic,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UpdateOrderStatusResponse> {
    return this.ordersService.updateStatusForSeller(id, currentUser.id, dto);
  }

  @Get()
  @Validate({
    response: { schema: OrdersListResponseSchema, stripUnknownProps: true },
  })
  findAll(
    @CurrentUser() currentUser: UserPublic,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<OrdersListResponse> {
    const normalizedPage = page < 1 ? 1 : page;
    const normalizedLimit = limit < 1 ? 10 : Math.min(limit, 100);

    return this.ordersService.findAllForUser(
      currentUser.id,
      normalizedPage,
      normalizedLimit,
    );
  }

  @Get(':id')
  @Validate({
    response: { schema: OrderDetailsResponseSchema, stripUnknownProps: true },
  })
  async findOne(
    @CurrentUser() currentUser: UserPublic,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderDetailsResponse> {
    const order = await this.ordersService.findOneForUser(
      id,
      currentUser.id,
      currentUser.role,
    );
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
