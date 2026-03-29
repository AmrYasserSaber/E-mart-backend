import {
  Controller,
  Get,
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
import {
  CreateOrderBodySchema,
  OrderDetailsResponse,
  OrderDetailsResponseSchema,
  OrdersListResponse,
  OrdersListResponseSchema,
  OrderResponse,
  OrderResponseSchema,
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
    createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<OrderResponse> {
    return this.ordersService.create(currentUser.id, createOrderDto);
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
