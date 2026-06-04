import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'rebirth-pos-backend',
      time: new Date().toISOString(),
    };
  }
}
