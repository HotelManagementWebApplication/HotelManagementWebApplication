package com.hospitality.mis.entity.identity;

import jakarta.persistence.*;
import java.time.Instant;

/** Append-only security history for every employee login attempt. */
@Entity
@Table(name = "employee_login_events")
public class EmployeeLoginEvent {
    public enum Outcome { SUCCEEDED, FAILED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    @JoinColumn(name = "employee_id", nullable = false) private Employee employee;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Outcome outcome;
    public Long getId() { return id; }
    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public Outcome getOutcome() { return outcome; }
    public void setOutcome(Outcome outcome) { this.outcome = outcome; }
    @PreUpdate @PreRemove void rejectMutation() { throw new IllegalStateException("Login history is append-only"); }
}
