FROM debian:buster-slim
# To avoid `apt-key output should not be parsed` warning
ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn
# default-jre needs this directory to exist on slim
RUN mkdir -p /usr/share/man/man1
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  make \
  build-essential \
  python \
  curl \
  default-jre \
  gnupg2 \ 
  # Set up node dependency apt repository
  && curl -sL https://deb.nodesource.com/setup_13.x | bash - \
  # Set up google-chrome dependency apt repository
  && curl -sL https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
  # Install chrome and node
  && apt-get update && apt-get install -y --no-install-recommends \
  google-chrome-stable \
  nodejs \
  && apt-get purge -y --auto-remove curl gnupg2 \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /var/cache/apt/archives/*

WORKDIR /usr/src/app
COPY . .
RUN npm upgrade chromedriver; npm install --no-optional ; cd client ; npm install --no-optional ; npm run build ; rm -rf node_modules ; cd ..
ENV PORT=3000
EXPOSE $PORT
CMD [ "npm", "start" ]