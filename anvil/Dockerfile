# Imagen propia de Anvil para el stack de blockchain.
# El binario de foundry no acepta el host por variable de entorno, y Coolify no
# aplicaba el `command:` del compose (el contenedor arrancaba con el `anvil`
# por defecto, que escucha solo en 127.0.0.1). Al bakar los flags en el CMD de
# la imagen, el nodo escucha en 0.0.0.0 sin depender de la UI de Coolify.
FROM ghcr.io/foundry-rs/foundry:v1.9.0

USER root
RUN mkdir -p /data

CMD ["anvil", "--host", "0.0.0.0", "--port", "8545", "--block-time", "1", "--state", "/data/anvil-state.json"]