import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@Controller()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      message: this.appService.getHello(),
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
