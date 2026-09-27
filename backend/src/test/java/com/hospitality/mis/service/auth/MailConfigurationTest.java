package com.hospitality.mis.service.auth;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MailConfigurationTest {
    @Test
    void localOtpSenderAndSmtpPasswordRemainConfiguredInYaml() throws Exception {
        try (InputStream yamlStream = new ClassPathResource("application.yml").getInputStream()) {
            Map<?, ?> document = new Yaml().load(yamlStream);
            Map<?, ?> spring = (Map<?, ?>) document.get("spring");
            Map<?, ?> mail = (Map<?, ?>) spring.get("mail");
            String username = mail.get("username").toString();
            String password = mail.get("password").toString();

            assertThat(username).isEqualTo("${MAIL_USERNAME:minhtuyen220706@gmail.com}");
            assertThat(password).startsWith("${MAIL_PASSWORD:").endsWith("}")
                    .doesNotContain("//", "2 dòng này");
        }
    }
}
