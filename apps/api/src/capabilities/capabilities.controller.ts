import { Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { CapabilitiesService } from './capabilities.service';

@Controller('capabilities')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  @Get()
  list(@Req() req: ScopedRequest) { return this.capabilities.listForUser(req.userId!); }

  @Post(':id/enable')
  enable(@Req() req: ScopedRequest, @Param('id') id: string) { return this.capabilities.enable(req.userId!, id); }

  @Post(':id/disable')
  disable(@Req() req: ScopedRequest, @Param('id') id: string) { return this.capabilities.disable(req.userId!, id); }
}
