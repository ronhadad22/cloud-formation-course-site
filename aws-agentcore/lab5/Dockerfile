FROM public.ecr.aws/lambda/python:3.11

# Copy requirements first for better caching
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY agent.py ${LAMBDA_TASK_ROOT}

# Set the handler
CMD ["agent.lambda_handler"]
