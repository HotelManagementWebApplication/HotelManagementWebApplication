package com.hospitality.mis.service.auth;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {
    @Mock
    private JavaMailSender mailSender;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailService(mailSender);
        ReflectionTestUtils.setField(emailService, "mailUsername", "minhtuyen220706@gmail.com");
        ReflectionTestUtils.setField(emailService, "mailPassword", "local-test-password");
    }

    @Test
    void sendsRegistrationOtpThroughConfiguredSender() throws Exception {
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        emailService.sendRegisterOtp("new-user@example.com", "123456");

        verify(mailSender).send(message);
        assertThat(message.getFrom()[0].toString()).contains("minhtuyen220706@gmail.com");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("new-user@example.com");
        assertThat(message.getSubject()).contains("đăng ký tài khoản");
    }

    @Test
    void missingSmtpCredentialsFailInsteadOfClaimingOtpWasSent() {
        ReflectionTestUtils.setField(emailService, "mailPassword", " ");

        assertThatThrownBy(() -> emailService.sendRegisterOtp("new-user@example.com", "123456"))
                .isInstanceOf(EmailDeliveryException.class);

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void smtpFailureIsPropagated() {
        when(mailSender.createMimeMessage())
                .thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        doThrow(new MailSendException("SMTP unavailable")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> emailService.sendRegisterOtp("new-user@example.com", "123456"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.");
    }
}
