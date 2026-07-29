# OTQue

A web app for tracking and fairly distributing overtime at shift-based jobs. Supports multiple rosters, role/subclass classification, holiday day types, and weighted fairness hours.

# Example docker-compose.yml (if building locally)

```
services:
  otqueue-app:
    build: .
    container_name: otqueue
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      # Maps the local 'data' folder to the app's real data directory inside the container. Change to your desired data storage location.
      - ./data:/app/data
```

# Example docker-compose.yml (from docker hub)

```
services:
  otqueue-app:
    image: alex12342/otqueue
    container_name: otqueue
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      # Maps the local 'data' folder to the app's real data directory inside the container. Change to your desired data storage location.
      - ./data:/app/data
```

Default credentials are: 

Email: admin@otqueue.local 
Password: Admin@123!
