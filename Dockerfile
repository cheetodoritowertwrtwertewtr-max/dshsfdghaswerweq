FROM python:3.12-alpine

WORKDIR /app
COPY . .

EXPOSE 8080

CMD ["sh", "-c", "python -m http.server ${PORT:-8080}"]
