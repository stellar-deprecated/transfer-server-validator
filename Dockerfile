FROM ubuntu:18.04

# Install dependencies and node
RUN apt-get update && apt-get install -y \
  curl \
  wget \
  gnupg2 \ 
  libtool-bin \
  default-jre \
  autoconf libssl-dev openssl \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
  && apt-get upgrade -y \
  && curl -sL https://deb.nodesource.com/setup_13.x | bash - \
  && apt-get install -y nodejs

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable && \
  rm -rf /var/lib/apt/lists/*

# Install chromedriver
RUN curl https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /chrome.deb
RUN dpkg -i /chrome.deb || apt-get install -yf
RUN rm /chrome.deb
RUN curl https://chromedriver.storage.googleapis.com/2.31/chromedriver_linux64.zip -o /usr/local/bin/chromedriver
RUN chmod +x /usr/local/bin/chromedriver

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "start" ]