# Scripts de Parsing de Luminarias

## Script de Parsing Automático MQTT

Este script se conecta a un broker MQTT, detecta tramas HSE de luminarias, las parsea y publica los valores convertidos en un tópico separado.

### Instalación de Dependencias

```bash
cd backend
npm install yargs
```

### Uso

#### Ejemplo básico (un tópico):
```bash
node scripts/parse-luminaria-mqtt.js --broker mqtt://192.168.64.174 --topic LM016
```

#### Múltiples tópicos:
```bash
node scripts/parse-luminaria-mqtt.js --broker mqtt://192.168.64.174 --topic LM016 --topic LM017 --topic LM018
```

#### Con logs detallados (verbose):
```bash
node scripts/parse-luminaria-mqtt.js --broker mqtt://192.168.64.174 --topic LM016 --verbose
```

### Opciones

- `--broker` / `-b`: URL del broker MQTT (requerido)
  - Ejemplo: `mqtt://192.168.64.174`
  - Ejemplo con autenticación: `mqtt://usuario:password@192.168.64.174:1883`

- `--topic` / `-t`: Tópico(s) a suscribir (requerido, puede especificarse múltiples veces)
  - Ejemplo: `--topic LM016 --topic LM017`

- `--verbose` / `-v`: Mostrar logs detallados (opcional)

### Funcionamiento

1. **Conexión**: El script se conecta al broker MQTT especificado
2. **Suscripción**: Se suscribe a los tópicos de luminarias especificados
3. **Detección**: Detecta automáticamente tramas HSE (formato: `HSE DDMMYY HHMM [datos binarios]`)
4. **Parsing**: Parsea los datos hexadecimales según las reglas:
   - **Valores estándar (2 bytes)**: Convierte a decimal y divide por 100
   - **SW y LP (32 bits)**: Combina High y Low, luego divide por 100
5. **Publicación**: Publica en dos tópicos:
   - **Tópico original**: `LM016` (trama cruda)
   - **Tópico procesado**: `LM016/procesado` (valores convertidos en JSON)

### Ejemplo de Salida

```
🔌 Conectando al broker: mqtt://192.168.64.174
✅ Conectado al broker MQTT
📡 Suscrito a: LM016

🔍 Trama HSE detectada en LM016
✅ Trama parseada correctamente:
   Fecha: 26/01/15 14:25
   VS: 5.43 V
   CS: 2.10 A
   SW: 12.50 W
   VB: 54.00 V
   CB: 0.20 A
   LV: 54.00 V
   LC: 0.00 A
   LP: 0.00 W
📤 Publicado en LM016/procesado
```

### Formato de Mensaje Procesado

El mensaje publicado en el tópico procesado es un JSON con la siguiente estructura:

```json
{
  "fecha": "26/01/15",
  "hora": "14:25",
  "timestamp": "2026-01-15T14:25:00.000Z",
  "voltajeSolar": 5.43,
  "corrienteSolar": 2.10,
  "potenciaSolar": 12.50,
  "voltajeBateria": 54.00,
  "corrienteBateria": 0.20,
  "voltajeCargas": 54.00,
  "corrienteCargas": 0.00,
  "potenciaCargas": 0.00
}
```

### Notas Importantes

- El script requiere que el broker MQTT esté accesible
- Los tópicos deben estar activos y recibiendo mensajes
- El script se ejecuta indefinidamente hasta que se interrumpa (Ctrl+C)
- El script maneja reconexiones automáticas si se pierde la conexión
