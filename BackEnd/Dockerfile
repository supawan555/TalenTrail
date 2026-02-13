
FROM python:3.14


WORKDIR /code


COPY requirements.txt .


RUN pip install --no-cache-dir -r requirements.txt


COPY ./app ./app


# Example : CMD ["fastapi", "run", "app/main.py", "--port", "80"]
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]