#!/bin/bash

openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout localhost.key \
    -out localhost.crt \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=LocalDev/OU=Dev/CN=localhost"
