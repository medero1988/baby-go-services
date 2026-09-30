import { IsOptional, IsString } from 'class-validator';

/**
 * Query crudo de GET /provider-orders. Se declara como strings para que el
 * parseo/validación (con errores `{ error, message }` propios) se haga en
 * `parseProviderOrdersQuery`.
 */
export class ListProviderOrdersQueryDto {
  /** CSV de estados: pending,accepted,progress,cancelled,completed */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}
