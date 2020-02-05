FROM ubuntu:18.04

# Install dependencies and node
RUN apt-get update && apt-get install -y \
  autoconf \
  curl \
  default-jre \
  gnupg2 \ 
  libtool-bin \
  wget \
  && rm -rf /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_13.x | bash - \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list

RUN apt-get update && apt-get install -y \
  google-chrome-stable=80.0.3987.87-1  \
  nodejs \
  && rm -rf /var/lib/apt/lists/*

# Install chromedriver
RUN curl https://chromedriver.storage.googleapis.com/80.0.3987.16/chromedriver_linux64.zip -o /usr/local/bin/chromedriver
RUN chmod +x /usr/local/bin/chromedriver

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN cd client ; npm install ; npm run build ; cd ..
EXPOSE 3000
CMD [ "npm", "start" ]