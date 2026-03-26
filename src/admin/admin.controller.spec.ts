import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Role } from '../common/enums/role.enum';
import type { ListUsersQuery, ManageUserBody } from './schemas/admin.schemas';

describe('AdminController', () => {
  let controller: AdminController;

  const adminServiceMock = {
    listUsers: jest.fn(),
    getUser: jest.fn(),
    manageUser: jest.fn(),
  };

  beforeEach(() => {
    controller = new AdminController(
      adminServiceMock as unknown as AdminService,
    );
    jest.clearAllMocks();
  });

  it('delegates listUsers', async () => {
    adminServiceMock.listUsers.mockResolvedValue({ items: [] });
    const query: ListUsersQuery = { page: 1, role: Role.USER };

    const result = await controller.listUsers(query);

    expect(result).toEqual({ items: [] });
    expect(adminServiceMock.listUsers).toHaveBeenCalledWith(query);
  });

  it('delegates getUser', async () => {
    adminServiceMock.getUser.mockResolvedValue({ id: 'u1' });

    const result = await controller.getUser('u1');

    expect(result).toEqual({ id: 'u1' });
    expect(adminServiceMock.getUser).toHaveBeenCalledWith('u1');
  });

  it('delegates manageUser', async () => {
    const dto: ManageUserBody = { role: Role.ADMIN, active: true };
    adminServiceMock.manageUser.mockResolvedValue({ id: 'u1', ...dto });

    const result = await controller.manageUser(dto, 'u1');

    expect(result).toEqual({ id: 'u1', ...dto });
    expect(adminServiceMock.manageUser).toHaveBeenCalledWith('u1', dto);
  });
});
