package com.groupys.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hot_take_answers", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"hot_take_id", "user_id"})
})
public class HotTakeAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hot_take_id", nullable = false)
    public HotTake hotTake;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    public User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String answer;

    @Column(columnDefinition = "TEXT")
    public String imageUrl;

    @Column(columnDefinition = "TEXT")
    public String musicType;

    @Column
    public boolean showOnWidget = false;

    @Column(nullable = false)
    public Instant answeredAt = Instant.now();
}
