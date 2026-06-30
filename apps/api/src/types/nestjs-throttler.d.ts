declare module '@nestjs/throttler' {
  import { CanActivate, ExecutionContext } from '@nestjs/common';
  import { DynamicModule } from '@nestjs/common';

  export interface ThrottlerModuleOptions {
    name?: string;
    ttl: number;
    limit: number;
  }

  export class ThrottlerModule {
    static forRoot(options: ThrottlerModuleOptions[]): DynamicModule;
  }

  export class ThrottlerGuard implements CanActivate {
    canActivate(context: ExecutionContext): Promise<boolean>;
  }

  export function Throttle(
    options: Record<string, { ttl: number; limit: number }>,
  ): ClassDecorator & MethodDecorator;

  export function SkipThrottle(skip?: boolean): ClassDecorator & MethodDecorator;
}
