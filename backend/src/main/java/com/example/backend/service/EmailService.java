package com.example.backend.service;

import com.example.backend.config.MailConfig;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final MailConfig mailConfig;

    public EmailService(JavaMailSender mailSender, MailConfig mailConfig) {
        this.mailSender = mailSender;
        this.mailConfig = mailConfig;
    }

    /**
     * Sends a password-reset notification email.
     *
     * @return true if sent successfully, false otherwise
     */
    public boolean sendPasswordResetEmail(String toEmail, String userName, String newPassword, String adminUser) {
        String subject = "Your password has been reset";
        String body = "Dear " + userName + ",\n\n"
                + "Your password has been reset to: " + newPassword + "\n\n"
                + "Regards,\n"
                + "Admin Team, " + adminUser;

        return sendEmail(toEmail, subject, body);
    }

    /**
     * Generic email sender. Failures are logged but never thrown.
     *
     * @return true if sent successfully, false otherwise
     */
    public boolean sendEmail(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            log.warn("[Email] No recipient address — skipping email (subject='{}')", subject);
            return false;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");

            String from = mailConfig.getFrom();
            String fromName = mailConfig.getFromName();
            if (from != null && !from.isBlank()) {
                if (fromName != null && !fromName.isBlank()) {
                    helper.setFrom(from, fromName);
                } else {
                    helper.setFrom(from);
                }
            }

            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body);

            mailSender.send(message);
            log.info("[Email] Sent to '{}' (subject='{}')", to, subject);
            return true;
        } catch (Exception e) {
            log.error("[Email] Failed to send to '{}': {}", to, e.getMessage());
            return false;
        }
    }
}
