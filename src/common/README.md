# Common Module

Este módulo contiene utilidades, interfaces y constantes compartidas en toda la aplicación.

## Estructura

```
common/
├── constants/       # Constantes de la aplicación
├── interfaces/      # Interfaces TypeScript compartidas
├── utils/          # Utilidades y helpers
└── filters/        # Filtros globales (excepciones, etc.)
```

## Uso

### Interfaces

```typescript
import { MqttMessage } from '../common/interfaces/mqtt-message.interface';
import { ApiResponse } from '../common/interfaces/api-response.interface';
```

### Constantes

```typescript
import { APP_CONSTANTS } from '../common/constants/app.constants';
```

### Utilidades

```typescript
import { ResponseUtil } from '../common/utils/response.util';
```

