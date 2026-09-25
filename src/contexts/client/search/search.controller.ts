import { Body, Controller, Post, Query } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import { SearchBodyDto } from './dto/search-body.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

/**
 * Catálogo público (productos + combos) para la app de clientes.
 * Sin JWT. Sigue pidiendo `x-api-token` como el resto de la API.
 */
@Controller(`${ROUTES.CLIENT}/search`)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Post()
  search(@Query() query: SearchQueryDto, @Body() body: SearchBodyDto) {
    return this.searchService.search(query, body);
  }
}
